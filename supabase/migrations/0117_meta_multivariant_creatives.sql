-- =============================================================================
-- 0117_meta_multivariant_creatives.sql
--
-- Phase 7.5 · Session 1.3 — multi-variant launches inside one ad set.
--
-- Session 1's `meta_ad_creatives_one_active_per_campaign` partial unique
-- index assumed ONE active creative per campaign (the "current ad" model;
-- Session 4's refresh stamps ended_at + inserts a fresh row). That falls
-- apart for the multi-variant launch shape — operator picks 3-9 variants,
-- the orchestrator drops them all into one ad set as separate ads, and
-- Meta auto-allocates spend by performance. All N creatives are active
-- concurrently.
--
-- The fix is to drop the partial unique constraint. Session 4's refresh
-- flow still works — it just becomes "bulk end every ended_at IS NULL
-- row for this campaign, then insert the new variant set" (was: "find
-- the one active row, stamp it, insert one"). The (meta_campaign_id,
-- started_at desc) read index (created in migration 0115) keeps
-- per-campaign creative lookup cheap.
--
-- No data loss — drop just removes the constraint, all existing rows
-- stay where they are.
-- =============================================================================

drop index if exists public.meta_ad_creatives_one_active_per_campaign;

comment on table public.meta_ad_creatives is
  'Every creative version that has run on a Meta campaign. Multiple rows may carry ended_at IS NULL simultaneously when the campaign is in a multi-variant test (Session 1.3+). Per-creative outcomes are derived by joining meta_ads_insights on date_recorded BETWEEN started_at AND ended_at; the active set is "every row with ended_at IS NULL".';
