-- =============================================================================
-- Webnua backend — RLS cross-tenant validation fixes.
--
-- The cross-tenant RLS negative-test harness (tests/rls/, run with
-- `pnpm test:rls`) found three holes in the Phase-5 policy set. This migration
-- closes all three. Nothing else in the RLS architecture changes.
--
-- ---------------------------------------------------------------------------
-- HOLE 1 — users: a client could escalate its own role / switch tenant.
--
--   users_update (0004) allows a user to UPDATE their own row
--   (`id = auth.uid() OR is_operator()`). The WITH CHECK only re-asserts the
--   same ownership test — it does NOT constrain WHICH columns change. A client
--   could therefore run
--       update public.users set role='admin', client_id=null, team_role='owner'
--       where id = auth.uid();
--   which satisfies the policy AND the users_role_shape CHECK, turning the
--   client into a full operator (is_operator() then reads role='admin'). The
--   same self-UPDATE could move client_id to another tenant.
--
--   Verified live before this fix: a Voltline client self-promoted to
--   `admin / owner` and to a FreshHome client_id.
--
--   Fix — a BEFORE UPDATE trigger. RLS WITH CHECK cannot compare OLD vs NEW;
--   a trigger can. Non-operators may still edit their own row (display name,
--   avatar) but role / client_id / team_role become immutable to them.
--   private.is_operator() reads the COMMITTED row, so a self-promoting client
--   is still 'client' at check time and is blocked; a real operator passes.
--
-- ---------------------------------------------------------------------------
-- HOLE 2 — website_versions: a workspace-wide capability grant let a client
--          write a version into ANOTHER tenant's website.
--
--   website_versions_insert (0013) gated INSERT solely on
--   private.has_capability(website_id, ...). has_capability() returns true for
--   a workspace-wide ('*' / website_id IS NULL) grant on ANY website — it is
--   a capability check, not a tenant check. A client holding a workspace-wide
--   editSections grant could therefore INSERT a draft version row for a
--   website belonging to a different client.
--
--   Verified live before this fix: a Voltline client (workspace-wide
--   editSections grant) wrote a draft website_versions row for a FreshHome
--   website.
--
--   Fix — AND a tenant-membership EXISTS check onto the WITH CHECK. Operators
--   still pass (accessible_client_ids() returns every client); a client with
--   a legitimate per-website grant still passes (the website's client is in
--   their accessible set); a cross-tenant write is now refused.
--
-- ---------------------------------------------------------------------------
-- HOLE 3 — website_approval_submissions: the same gap.
--
--   website_approval_submissions_insert (0015) gated INSERT on
--   `submitter_id = auth.uid() AND has_capability(website_id, 'editSections')`
--   — again no tenant check. Verified live before this fix.
--
--   Fix — the same tenant-membership AND-clause.
--
-- The funnel-side equivalents (funnel_versions_insert,
-- funnel_approval_submissions_insert) were authored WITH the tenant EXISTS
-- check already (0014 / 0015) and are not affected.
-- =============================================================================

-- --- HOLE 1: lock the identity columns of public.users ----------------------
create or replace function private.guard_user_identity_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Operators may change anything (team management, onboarding, role moves).
  if private.is_operator() then
    return new;
  end if;
  -- A non-operator (any client, or a self-update) may not touch the columns
  -- that decide tenancy and privilege.
  if new.role is distinct from old.role
     or new.client_id is distinct from old.client_id
     or new.team_role is distinct from old.team_role then
    raise exception
      'permission denied: role, client_id and team_role are operator-managed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_identity_columns on public.users;
create trigger users_guard_identity_columns
  before update on public.users
  for each row execute function private.guard_user_identity_columns();

-- --- HOLE 2: website_versions INSERT must be tenant-bounded ------------------
drop policy website_versions_insert on public.website_versions;
create policy website_versions_insert on public.website_versions
  for insert to authenticated
  with check (
    -- the website must belong to a client the caller can access ...
    exists (
      select 1 from public.websites w
      where w.id = website_versions.website_id
        and w.client_id in (select private.accessible_client_ids())
    )
    -- ... AND the caller must hold the matching capability on it.
    and private.has_capability(
      website_id,
      case when status = 'published'
        then 'publish'::public.capability
        else 'editSections'::public.capability
      end
    )
  );

-- --- HOLE 3: website_approval_submissions INSERT must be tenant-bounded ------
drop policy website_approval_submissions_insert on public.website_approval_submissions;
create policy website_approval_submissions_insert on public.website_approval_submissions
  for insert to authenticated
  with check (
    submitter_id = (select auth.uid())
    and exists (
      select 1 from public.websites w
      where w.id = website_approval_submissions.website_id
        and w.client_id in (select private.accessible_client_ids())
    )
    and private.has_capability(website_id, 'editSections'::public.capability)
  );
