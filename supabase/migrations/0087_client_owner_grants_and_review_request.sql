-- =============================================================================
-- Pattern B critical fixes · Session 1.
--
-- Three changes that ship together because the audit (reference/client-access-
-- audit.md) called them out as Pattern B's launch-blockers:
--
--   1. CLIENT_OWNER_DEFAULTS backfill — every existing client-role user whose
--      workspace is in a live state (preview / active / live / onboarding) gets
--      a workspace-wide capability_grants row with the full owner bundle, so
--      they can edit copy / media / sections, publish, restore versions, and
--      manage domains. The 0087 trigger keeps NEW client-role users on the
--      CLIENT_DEFAULTS floor (teammate-invite ergonomics); only the signup
--      flow + the operator concierge invite-accept path issue the owner
--      grant going forward.
--
--   2. clients_update RLS widening — a workspace owner can update their own
--      clients row (profile fields: name, primary_contact_*, service_area).
--      Previously operator-only. Tenant-scoped: a user may update ONLY a
--      clients row they belong to (clients.id IN accessible_client_ids())
--      AND must hold the `publish` capability workspace-wide. Helpers live in
--      the `private` schema (moved out of `public` in Phase 5b; original
--      `public.is_operator` / `public.accessible_client_ids` references in
--      this migration would error with `function ... does not exist`).
--
--   3. clients.review_requested_at — optional "request operator review before
--      publishing" affordance on the Pattern B publish CTA. NULL = not
--      requested; non-NULL = the operator queue picks it up. Cleared by the
--      operator when they mark the request handled. Mirrors the
--      re_engagement_sent_at shape (a single timestamptz, no separate audit
--      table — the operator handles the review out-of-band).
-- =============================================================================

-- -- 1. backfill CLIENT_OWNER_DEFAULTS for existing client-role owners -------
--
-- Existing rows are all "owners" (the multi-teammate-per-client case has not
-- been wired into a real invite-acceptance flow yet — every client-role row
-- in production is the signup user). Skip users that already hold ANY
-- workspace-wide grant (NULL website_id) so an operator-tweaked grant isn't
-- clobbered by the floor list. The grant set is the SoT in lockstep with
-- `CLIENT_OWNER_DEFAULTS` in `src/lib/auth/capabilities.ts`.

insert into public.capability_grants (user_id, website_id, capabilities)
select
  u.id,
  null,
  array[
    'viewBuilder',
    'editCopy',
    'editMedia',
    'editSEO',
    'editLayout',
    'editSections',
    'editTheme',
    'editPages',
    'editForms',
    'useAI',
    'publish',
    'rollback',
    'manageDomain'
  ]::public.capability[]
from public.users u
join public.clients c on c.id = u.client_id
where u.role = 'client'
  and c.lifecycle_status in (
    'preview'::public.client_lifecycle,
    'active'::public.client_lifecycle,
    'live'::public.client_lifecycle,
    'onboarding'::public.client_lifecycle
  )
  and not exists (
    select 1
    from public.capability_grants g
    where g.user_id = u.id
      and g.website_id is null
  );

-- -- 2. clients_update — widen for workspace owners ------------------------
--
-- An owner with the `publish` capability can update their own clients row.
-- We gate on `publish` (rather than just role='client' + tenant match) so an
-- invited teammate without the owner bundle CANNOT edit the workspace's
-- profile fields — preserves the floor/owner separation the cap layer is
-- built on.
--
-- The check matches USING — both halves keep the row inside the user's own
-- tenant (the audit flagged users_update for a similar pre-trigger gap;
-- this policy uses RLS-only since no immutable-column guard is required here:
-- every column on clients is honest to expose to its owner).

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients
  for update to authenticated
  using (
    private.is_operator()
    or (
      id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'publish'::public.capability)
    )
  )
  with check (
    private.is_operator()
    or (
      id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'publish'::public.capability)
    )
  );

-- -- 3. clients.review_requested_at ---------------------------------------

alter table public.clients
  add column if not exists review_requested_at timestamptz;

comment on column public.clients.review_requested_at is
  'Pattern B: optional "request operator review before publishing" timestamp. '
  'Set by POST /api/clients/[id]/request-review when the client opts for '
  'concierge review instead of direct publish. Cleared by the operator after '
  'handling. NULL = no request in flight.';

create index if not exists clients_review_requested_at_idx
  on public.clients (review_requested_at)
  where review_requested_at is not null;
