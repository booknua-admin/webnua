-- =============================================================================
-- Webnua backend — Phase 1 Session A · RLS helper functions.
--
-- backend-schema-design.md §4.1. Every function is SECURITY DEFINER with an
-- empty search_path: definer rights mean a policy on `users` that calls
-- is_operator() (which reads `users`) does NOT recurse through RLS, and the
-- empty search_path is the hardening the Supabase advisors expect. STABLE so
-- the planner evaluates them once per statement, not per row.
-- =============================================================================

-- True when the caller is an operator (admin role).
create or replace function public.is_operator()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- True when the caller is an owner/operator team-role (not a junior).
-- Gates HQ-level writes (agency policy, plan catalog, junior scoping).
create or replace function public.is_senior_operator()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid())
      and role = 'admin' and team_role in ('owner', 'operator')
  );
$$;

-- The caller's home client business — NULL for operators.
create or replace function public.current_client_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select client_id from public.users where id = (select auth.uid());
$$;

-- Every client id the caller may see:
--   owner/operator -> all clients; junior -> their assigned set;
--   client user    -> their own client.
create or replace function public.accessible_client_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.clients c
  where exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and u.role = 'admin' and u.team_role in ('owner', 'operator')
  )
  union
  select uca.client_id from public.user_client_access uca
  where uca.user_id = (select auth.uid())
  union
  select u.client_id from public.users u
  where u.id = (select auth.uid()) and u.client_id is not null;
$$;

-- The SQL form of the capability resolver, scoped to one website:
--   operator -> every capability;
--   viewBuilder -> the client role-default floor (any signed-in user);
--   else -> an explicit grant, per-website or workspace-wide (NULL website).
-- Used by the builder-table policies in Phase 1b; created here per §4.1.
create or replace function public.has_capability(
  target_website_id uuid,
  cap public.capability
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    public.is_operator()
    or (cap = 'viewBuilder' and exists (
      select 1 from public.users where id = (select auth.uid())
    ))
    or exists (
      select 1 from public.capability_grants g
      where g.user_id = (select auth.uid())
        and cap = any (g.capabilities)
        and (g.website_id is null or g.website_id = target_website_id)
    );
$$;
