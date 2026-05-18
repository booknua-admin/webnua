-- =============================================================================
-- Webnua backend — Phase 1 Session A · RLS policies (identity + policy layer).
--
-- backend-schema-design.md §4. Every table has RLS enabled; policies target
-- the `authenticated` role only — `anon` matches no policy and is denied;
-- `service_role` bypasses RLS (seeding works regardless). Helper functions
-- (0003) are SECURITY DEFINER so policies that read users/clients don't recurse.
--
-- The hard tenant boundary: a client can never read another client's rows.
-- =============================================================================

-- ===== clients ===============================================================
alter table public.clients enable row level security;
-- Read: any client/operator who has the client in scope.
create policy clients_select on public.clients
  for select to authenticated
  using (id in (select public.accessible_client_ids()));
-- Write: operators only — client onboarding/management is an operator action.
create policy clients_insert on public.clients
  for insert to authenticated with check (public.is_operator());
create policy clients_update on public.clients
  for update to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy clients_delete on public.clients
  for delete to authenticated using (public.is_operator());

-- ===== users =================================================================
alter table public.users enable row level security;
-- Read: yourself; users of a client you can access; operators see everyone.
create policy users_select on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or client_id in (select public.accessible_client_ids())
    or public.is_operator()
  );
-- Insert: operators. Real signup provisions the row via a definer trigger
-- (Phase 2), which bypasses this policy.
create policy users_insert on public.users
  for insert to authenticated with check (public.is_operator());
-- Update: yourself, or an operator.
create policy users_update on public.users
  for update to authenticated
  using (id = (select auth.uid()) or public.is_operator())
  with check (id = (select auth.uid()) or public.is_operator());
-- Delete: operators only.
create policy users_delete on public.users
  for delete to authenticated using (public.is_operator());

-- ===== brands ================================================================
alter table public.brands enable row level security;
-- Read: anyone who can access the client.
create policy brands_select on public.brands
  for select to authenticated
  using (client_id in (select public.accessible_client_ids()));
-- Write: operators. Tightens to has_capability(...,'editTheme') in Phase 1b,
-- once websites exist and the editTheme path is wired.
create policy brands_insert on public.brands
  for insert to authenticated with check (public.is_operator());
create policy brands_update on public.brands
  for update to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy brands_delete on public.brands
  for delete to authenticated using (public.is_operator());

-- ===== capability_grants =====================================================
alter table public.capability_grants enable row level security;
-- Read: your own grants; operators see all.
create policy capability_grants_select on public.capability_grants
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_operator());
-- Write: operators only — grants are managed from /settings/access.
create policy capability_grants_insert on public.capability_grants
  for insert to authenticated with check (public.is_operator());
create policy capability_grants_update on public.capability_grants
  for update to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy capability_grants_delete on public.capability_grants
  for delete to authenticated using (public.is_operator());

-- ===== user_client_access ====================================================
alter table public.user_client_access enable row level security;
-- Read: your own access rows; operators see all.
create policy user_client_access_select on public.user_client_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_operator());
-- Write: senior operators only — owner/operator manage junior scoping.
create policy user_client_access_insert on public.user_client_access
  for insert to authenticated with check (public.is_senior_operator());
create policy user_client_access_update on public.user_client_access
  for update to authenticated
  using (public.is_senior_operator()) with check (public.is_senior_operator());
create policy user_client_access_delete on public.user_client_access
  for delete to authenticated using (public.is_senior_operator());

-- ===== team_invites ==========================================================
alter table public.team_invites enable row level security;
-- Operator-only — the org-invite surface is operator-facing throughout.
create policy team_invites_select on public.team_invites
  for select to authenticated using (public.is_operator());
create policy team_invites_insert on public.team_invites
  for insert to authenticated with check (public.is_operator());
create policy team_invites_update on public.team_invites
  for update to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy team_invites_delete on public.team_invites
  for delete to authenticated using (public.is_operator());

-- ===== team_invite_clients ===================================================
alter table public.team_invite_clients enable row level security;
-- Operator-only — the junior-scoping detail of an operator-only invite.
create policy team_invite_clients_select on public.team_invite_clients
  for select to authenticated using (public.is_operator());
create policy team_invite_clients_insert on public.team_invite_clients
  for insert to authenticated with check (public.is_operator());
create policy team_invite_clients_delete on public.team_invite_clients
  for delete to authenticated using (public.is_operator());

-- ===== client_user_invites ===================================================
alter table public.client_user_invites enable row level security;
-- Read: client users of that client + operators who can access it.
create policy client_user_invites_select on public.client_user_invites
  for select to authenticated
  using (client_id in (select public.accessible_client_ids()));
-- Insert: a client user inviting into their own client, or an operator.
create policy client_user_invites_insert on public.client_user_invites
  for insert to authenticated
  with check (
    client_id = (select public.current_client_id())
    or public.is_operator()
  );
-- Update/Delete (revoke): the client or an operator who can access it.
create policy client_user_invites_update on public.client_user_invites
  for update to authenticated
  using (client_id in (select public.accessible_client_ids()))
  with check (client_id in (select public.accessible_client_ids()));
create policy client_user_invites_delete on public.client_user_invites
  for delete to authenticated
  using (client_id in (select public.accessible_client_ids()));

-- ===== seat_limit_changes ====================================================
alter table public.seat_limit_changes enable row level security;
-- Read: the client's own history; operators see accessible clients'.
create policy seat_limit_changes_select on public.seat_limit_changes
  for select to authenticated
  using (client_id in (select public.accessible_client_ids()));
-- Insert: operators. No update/delete policy — append-only event log.
create policy seat_limit_changes_insert on public.seat_limit_changes
  for insert to authenticated with check (public.is_operator());

-- ===== agency_policy =========================================================
alter table public.agency_policy enable row level security;
-- Read: any operator — agency HQ is operator-only.
create policy agency_policy_select on public.agency_policy
  for select to authenticated using (public.is_operator());
-- Write: senior operators only — owner/operator set HQ-wide policy.
create policy agency_policy_insert on public.agency_policy
  for insert to authenticated with check (public.is_senior_operator());
create policy agency_policy_update on public.agency_policy
  for update to authenticated
  using (public.is_senior_operator()) with check (public.is_senior_operator());
create policy agency_policy_delete on public.agency_policy
  for delete to authenticated using (public.is_senior_operator());

-- ===== plan_catalog ==========================================================
alter table public.plan_catalog enable row level security;
-- Read: any operator; a client may read the plan it is assigned.
create policy plan_catalog_select on public.plan_catalog
  for select to authenticated
  using (
    public.is_operator()
    or id in (
      select plan_id from public.plan_assignments
      where client_id = (select public.current_client_id())
    )
  );
-- Write: senior operators only — the plan catalog is HQ-level.
create policy plan_catalog_insert on public.plan_catalog
  for insert to authenticated with check (public.is_senior_operator());
create policy plan_catalog_update on public.plan_catalog
  for update to authenticated
  using (public.is_senior_operator()) with check (public.is_senior_operator());
create policy plan_catalog_delete on public.plan_catalog
  for delete to authenticated using (public.is_senior_operator());

-- ===== plan_assignments ======================================================
alter table public.plan_assignments enable row level security;
-- Read: the client's own assignment; operators see accessible clients'.
create policy plan_assignments_select on public.plan_assignments
  for select to authenticated
  using (client_id in (select public.accessible_client_ids()));
-- Write: operators — assigning a plan is an operator action.
create policy plan_assignments_insert on public.plan_assignments
  for insert to authenticated with check (public.is_operator());
create policy plan_assignments_update on public.plan_assignments
  for update to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy plan_assignments_delete on public.plan_assignments
  for delete to authenticated using (public.is_operator());

-- ===== policy_overrides ======================================================
alter table public.policy_overrides enable row level security;
-- Read: the client's own overrides; operators see accessible clients'.
create policy policy_overrides_select on public.policy_overrides
  for select to authenticated
  using (client_id in (select public.accessible_client_ids()));
-- Write: operators — per-sub-account overrides are set by operators.
create policy policy_overrides_insert on public.policy_overrides
  for insert to authenticated with check (public.is_operator());
create policy policy_overrides_update on public.policy_overrides
  for update to authenticated
  using (public.is_operator()) with check (public.is_operator());
create policy policy_overrides_delete on public.policy_overrides
  for delete to authenticated using (public.is_operator());
