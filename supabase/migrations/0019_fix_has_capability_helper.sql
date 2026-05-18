-- =============================================================================
-- Webnua backend — Phase 2 · repair the has_capability() RLS helper.
--
-- has_capability()'s body (authored in 0003) calls `public.is_operator()`.
-- Migration 0005 moved is_operator() into the `private` schema but only ran
-- `alter function ... set schema private` — it never recreated has_capability()'s
-- body, which still hard-codes the now-stale `public.is_operator()` reference.
-- Every has_capability() evaluation therefore fails with
--   ERROR: function public.is_operator() does not exist
-- which breaks every builder-table RLS policy that gates a mutation
-- (website_versions insert/update, pages/sections edits, …). The simple
-- tenant-isolation policies were unaffected — they lean on
-- accessible_client_ids(), which only references tables.
--
-- Recreate the body against the private-schema helper. Pure body fix —
-- signature, volatility, and security context are unchanged, so the existing
-- policies that reference private.has_capability() keep working.
-- =============================================================================

create or replace function private.has_capability(
  target_website_id uuid,
  cap public.capability
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select
    private.is_operator()
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
