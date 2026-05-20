-- =============================================================================
-- Webnua backend — `leads.source_funnel_id` — funnel-to-lead attribution.
--
-- Closes the analytics-audit follow-up: the `/funnels/[id]` hero "booked from
-- this funnel" tile was rendering `—` because there was no link between a
-- captured lead and the funnel that captured it. `leads.source_kind` (added
-- in 0043) gives the *categorical* source (website / funnel / meta) for the
-- inbox column, but not *which* funnel — and a client can run multiple.
--
-- This adds the entity-FK: nullable, references `public.funnels`. NULL =
-- captured outside a funnel (every website-form submission, plus every lead
-- created before this migration). Set-null on delete so a removed funnel
-- doesn't drag its captured leads with it — the leads stay, just unattributed.
--
-- Single-column index on the FK powers the analytics roll-up query
-- (`getBookedFromFunnelCount`): one count over leads filtered by
-- source_funnel_id + status. The query is per-funnel + per-status; client_id
-- is implied by the funnel and adds nothing to selectivity, so no composite.
-- =============================================================================

alter table public.leads
  add column if not exists source_funnel_id uuid
    references public.funnels (id) on delete set null;

create index if not exists leads_source_funnel_id_idx
  on public.leads (source_funnel_id);
