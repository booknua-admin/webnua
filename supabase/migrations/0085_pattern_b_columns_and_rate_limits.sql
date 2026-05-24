-- =============================================================================
-- Webnua backend — Pattern B onboarding · columns + rate-limit infrastructure.
--
-- Follow-on to 0084 (enum extension): the new lifecycle values are now
-- committed and safe to reference. This migration:
--   (1) flips the `clients.lifecycle_status` default from 'onboarding' to
--       'pending_verification' — Pattern B's signup entry state.
--   (2) adds `clients.re_engagement_sent_at` (the daily cron's send-once
--       tracker for the 7-day re-engagement email).
--   (3) creates `public.rate_limit_hits` — the generic append-only log
--       backing both IP-based signup limits (3/IP/24h, 10/IP/hour) AND
--       per-workspace AI-generation limits (3 site-gen/24h, 3 funnel-gen/
--       24h, 10 section-regen/hour). One row per attempt; the 0086 cron
--       deletes rows older than 7 days.
--
-- DATA MIGRATION. Session 1 inserted clients with the old default
-- 'onboarding'. Those rows stay as 'onboarding' — the lifecycle.ts mapper
-- treats 'onboarding' AND 'preview' AND 'pending_verification' as the
-- "pre-active" states for dispatch purposes. No backfill needed.
--
-- The operator concierge path (lib/clients/create-client.ts) is updated in
-- the app layer to write 'active' explicitly, so it never depends on the
-- new default.
-- =============================================================================

-- --- 1. flip the default ----------------------------------------------------
alter table public.clients
  alter column lifecycle_status set default 'pending_verification';

-- --- 2. re-engagement send tracker -----------------------------------------
alter table public.clients
  add column if not exists re_engagement_sent_at timestamptz;

comment on column public.clients.re_engagement_sent_at is
  'Pattern B: when the 7-day re-engagement email fired. NULL = not sent. '
  'Set by the webnua_re_engagement_scan cron (migration 0086). Drives the '
  'send-once-per-client semantics.';

-- --- 3. rate_limit_hits append-only log ------------------------------------
--
-- Single generic table for every kind of rate limit Pattern B enforces:
--
--   action            key (per-action format)            limit + window
--   ----------------- ----------------------------------- -----------------
--   signup_attempt    {ip}                                10/IP/hour
--   signup_success    {ip}                                3/IP/24h
--   ai_site_gen       {client_id}                         3/client/24h
--   ai_funnel_gen     {client_id}                         3/client/24h
--   ai_section_regen  {client_id}                         10/client/hour
--
-- The query shape is `select count(*) where action = ? and key = ? and
-- occurred_at > now() - interval '?'`. The composite index on
-- (action, key, occurred_at desc) covers it. `client_id` (FK) is populated
-- only for AI-gen actions so a client-deletion CASCADE clears their hits.
-- The signup actions carry ip (no client_id yet — workspace may not exist).
--
-- RLS: operators read-only for operator dashboards; writes are service-role
-- only (the route handlers run with the integration_db service client).
-- Clients have no read access — rate-limit telemetry is internal.

create table if not exists public.rate_limit_hits (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  key         text not null,
  client_id   uuid references public.clients(id) on delete cascade,
  ip          inet,
  status      text not null default 'ok' check (status in ('ok', 'blocked')),
  reason      text,
  occurred_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_action_key_at_idx
  on public.rate_limit_hits (action, key, occurred_at desc);
create index if not exists rate_limit_hits_client_at_idx
  on public.rate_limit_hits (client_id, occurred_at desc)
  where client_id is not null;
-- Cleanup-cron uses a plain index on occurred_at to delete the old window.
create index if not exists rate_limit_hits_occurred_at_idx
  on public.rate_limit_hits (occurred_at);

comment on table public.rate_limit_hits is
  'Pattern B: append-only log of rate-limit attempts. One row per check, '
  'whether allowed or blocked. The 0086 cron deletes rows older than 7 days.';

-- --- 4. RLS -----------------------------------------------------------------
alter table public.rate_limit_hits enable row level security;

-- Operators (admin role) see every row — the /admin/signups surface lists
-- recent blocks across the platform. Clients have no access. Service role
-- (the route handlers) writes through; service-role bypasses RLS anyway, so
-- no insert policy is needed.
drop policy if exists rate_limit_hits_select on public.rate_limit_hits;
create policy rate_limit_hits_select on public.rate_limit_hits
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.role = 'admin'
    )
  );

-- Strict no-write for `authenticated` — only the service role writes,
-- bypassing RLS. The empty INSERT/UPDATE/DELETE policies refuse explicitly
-- (defence in depth; the table is operator-read-only from any UI).
revoke insert, update, delete on public.rate_limit_hits from authenticated;

-- --- 5. email-verification → lifecycle transition trigger ------------------
--
-- When a `pending_verification` user clicks the magic-link from their
-- verification email, Supabase Auth sets `auth.users.email_confirmed_at`.
-- This trigger picks up that transition and advances the matching
-- `public.clients.lifecycle_status` from 'pending_verification' to
-- 'preview' so the dashboard dispatcher picks up the new state on the
-- next render.
--
-- Guarded transition — fires ONLY on a true NULL→non-NULL transition of
-- `email_confirmed_at`, and the UPDATE's WHERE clause restricts to clients
-- currently in 'pending_verification'. So:
--   - Re-clicking a magic link after verification: trigger sees no transition
--     (already non-NULL), no-op.
--   - Operator-created (active) clients: WHERE clause filters them out.
--   - Already-preview/active clients: WHERE clause filters them out.
--
-- SECURITY DEFINER so the trigger updates public.clients under the function
-- owner's rights (the caller during sign-in is the unauthenticated user
-- following the magic link; RLS on clients_update would otherwise refuse).
-- Empty search_path matches the codebase convention (migrations 0017, 0063).

create or replace function public.advance_lifecycle_on_email_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  -- Resolve the verified user's client_id (public.users carries the FK).
  -- A user with no client_id (operator) is filtered out — operators do not
  -- have a clients row to advance.
  select u.client_id into v_client_id
    from public.users u
   where u.id = new.id;

  if v_client_id is null then
    return new;
  end if;

  update public.clients
     set lifecycle_status = 'preview'
   where id = v_client_id
     and lifecycle_status = 'pending_verification';

  return new;
end;
$$;

drop trigger if exists on_auth_email_verified on auth.users;
create trigger on_auth_email_verified
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.advance_lifecycle_on_email_verified();

comment on function public.advance_lifecycle_on_email_verified() is
  'Pattern B: on first email confirmation, advance the matching client from '
  'pending_verification to preview. Guarded — no-op for re-confirmations, '
  'operator-created clients, and clients already past pending_verification.';
