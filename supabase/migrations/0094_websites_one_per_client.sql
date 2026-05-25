-- =============================================================================
-- 0094 — websites: one per client (Phase 2 parity fix)
--
-- The wizard-assets idempotency probe (POST /api/clients/[id]/wizard-assets)
-- + the operator-concierge createWebsiteForClient guard both make it nearly
-- impossible to create duplicate websites going forward. But three clients
-- on the live DB already have two each (getSparkit, Lucan Flooring, Cork
-- Cleaning Co — all hit a race or a refresh mid-flow before the idempotency
-- probe shipped):
--
--   client_id                              | website_count
--   --------------------------------------- | -------------
--   93143033-dd3a-49ed-950c-daf1487dfbbb   | 2  (Lucan Flooring)
--   e8e7c3ee-fd7b-4a9d-8b98-c5eaa0adf9f7   | 2  (getSparkit)
--   f8052970-2e51-4f78-8c9f-3cda86e192b7   | 2  (Cork Cleaning Co)
--
-- Remediation strategy (chosen after FK + state probe — see CLAUDE.md
-- parked decision "Websites one-per-client unique constraint"):
--
--   * Hard-delete the OLDER website row for each affected client. FKs
--     CASCADE cleanly (website_versions, content_drafts, capability_grants,
--     force_publish_audit_log, website_approval_submissions all CASCADE on
--     websites delete; tickets.context_website_id is SET NULL).
--   * None of the older rows have a published_version_id set (verified
--     pre-migration via SQL probe). No live URL points to them; deletion
--     loses nothing the customer can see today.
--   * Generic CTE picks "older row per client" so a future race that slips
--     past the idempotency probes is also cleaned up at apply time.
--
-- After dedup, add UNIQUE(client_id) as the forcing-function guarantee.
-- The wizard-assets route, createWebsiteForClient, and any other future
-- entry point will now FAIL LOUDLY at the data layer rather than silently
-- producing duplicates.
-- =============================================================================

-- 1. Remediate existing duplicates (older row wins delete).
with duplicates as (
  select
    id,
    client_id,
    row_number() over (
      partition by client_id
      order by created_at desc, id desc
    ) as rn
  from public.websites
),
to_delete as (
  select id from duplicates where rn > 1
)
delete from public.websites where id in (select id from to_delete);

-- 2. Forcing-function constraint — one website per client, going forward.
-- Named `websites_one_per_client` (the convention used by SUB_ACCOUNT_OVERRIDE_SEED
-- and other domain unique constraints in this codebase).
alter table public.websites
  add constraint websites_one_per_client unique (client_id);

comment on constraint websites_one_per_client on public.websites is
  'One website per client. Enforced V1 forcing function — a multi-website-per-client client (rare; multi-brand operator) needs the constraint loosened + a `primary` flag (same pattern as client_gbp_locations / client_meta_ad_accounts). Phase 2 parity fix (migration 0094).';
