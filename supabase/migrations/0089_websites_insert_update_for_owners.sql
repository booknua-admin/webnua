-- =============================================================================
-- Pattern B critical fixes · Session 2 hotfix.
--
-- The ScaffoldWebsiteButton (sub-account mode) calls createWebsiteForClient
-- → supabase.from('websites').insert(...) → supabase.from('websites').update(
-- { draft_version_id }). Both went through `private.is_operator()` per the
-- original 0013 policies; a client owner clicking Scaffold 403s.
--
-- Same widening pattern as clients_update (0087), funnels_update + brands_
-- update (0088): a user with the `editPages` capability who belongs to the
-- target client may insert + update the websites row. `editPages` is in
-- CLIENT_OWNER_DEFAULTS, matches the cap the UI gates the button on, and
-- is more permissive-on-the-write than `publish` (publish is about a
-- *version* going live — creating the website itself is a structural act).
--
-- The check on INSERT verifies the new row's `client_id` is in the writer's
-- accessible_client_ids; the check on UPDATE keeps the writer scoped to the
-- existing row's client. `delete` stays operator-only (taking a website
-- offline entirely is governance).
-- =============================================================================

drop policy if exists websites_insert on public.websites;
create policy websites_insert on public.websites
  for insert to authenticated
  with check (
    private.is_operator()
    or (
      client_id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'editPages'::public.capability)
    )
  );

drop policy if exists websites_update on public.websites;
create policy websites_update on public.websites
  for update to authenticated
  using (
    private.is_operator()
    or (
      client_id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'editPages'::public.capability)
    )
  )
  with check (
    private.is_operator()
    or (
      client_id in (select private.accessible_client_ids())
      and private.has_capability(null::uuid, 'editPages'::public.capability)
    )
  );
