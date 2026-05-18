-- =============================================================================
-- Webnua backend — Phase 5 · capability-gate the brands UPDATE (§4.3).
--
-- backend-schema-design.md §4.3: "brands UPDATE → has_capability(<any website
-- of this client>, 'editTheme')". The 0004 brands_update policy was authored
-- operator-only with a comment promising the editTheme tightening "in
-- Phase 1b" — this is that tightening, deferred to the real-auth phase.
--
-- brands is keyed on client_id (one brand per client), but has_capability()
-- resolves a *website* grant. So the check is "does the user hold editTheme
-- on ANY website belonging to this brand's client". has_capability() itself
-- short-circuits to true for operators, so this also covers the operator
-- path — no separate is_operator() branch needed in the check.
--
-- INSERT / DELETE stay operator-only: creating or removing a client's brand
-- row is a provisioning act, not a theme edit.
-- =============================================================================

drop policy if exists brands_update on public.brands;

create policy brands_update on public.brands
  for update to authenticated
  using (
    brands.client_id in (select private.accessible_client_ids())
  )
  with check (
    exists (
      select 1 from public.websites w
      where w.client_id = brands.client_id
        and private.has_capability(w.id, 'editTheme'::public.capability)
    )
    -- A client with no website yet: only operators may touch the brand
    -- (has_capability short-circuits true for operators above; this OR
    -- keeps the operator path open when the EXISTS finds no website row).
    or private.is_operator()
  );
