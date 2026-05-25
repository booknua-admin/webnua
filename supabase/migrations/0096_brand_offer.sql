-- =============================================================================
-- Webnua backend — Session C.5 · brand-level offer.
--
-- Promotes the four-field offer from `funnels.funnel_offer` (per-funnel) to
-- `brands.offer` (per-brand) so the offer becomes a single source of truth
-- that propagates to:
--   - The website hero CTA (when no explicit section override is set)
--   - The dedicated offer section (when section copy fields are empty)
--   - The funnel hero (with funnel.funnel_offer remaining as an override
--     for the V1.1 multi-funnel case)
--
-- Shape (jsonb): { headline, promise, risk_reversal, cta_text } — snake_case
-- keys to match funnels.funnel_offer and the rest of the DB. Matches the
-- existing funnel_offer shape verbatim so the backfill is a direct copy.
--
-- Why a single jsonb column rather than four text columns (same rationale as
-- migration 0037): the four fields are one atomic unit — always created
-- together (by /api/generate-offer), always edited together (in /settings/
-- brand), always rendered together. Matches the existing `derived_palette`
-- and `funnel_testimonials` jsonb precedents.
--
-- funnels.funnel_offer is NOT dropped — it stays as the per-funnel override
-- path. Read order at consumers:
--   - Funnel rendering:  funnel.funnel_offer ?? brand.offer ?? null
--   - Site rendering:    section override ?? brand.offer ?? null
--   - Generation prompt: brand.offer ?? funnel.funnel_offer ?? null
--
-- Rollback (manual, forward-only project style):
--   alter table public.brands drop column if exists offer;
-- The backfill is non-destructive (does not modify funnel_offer), so a
-- rollback recovers the pre-migration state by dropping the column alone.
-- =============================================================================

alter table public.brands
  add column if not exists offer jsonb;

comment on column public.brands.offer is
  'Brand-level four-field offer { headline, promise, risk_reversal, cta_text } — the single source of truth that propagates to website hero CTA, the dedicated offer section, and the funnel hero. Per-funnel overrides remain on funnels.funnel_offer (V1.1).';

-- Backfill: for each brand whose client has at least one funnel with
-- funnel_offer set, copy the EARLIEST funnel's offer onto the brand.
-- "Earliest" by funnels.created_at, with id as a deterministic tie-breaker.
-- A 1:1 brand <-> client relationship (brands.client_id is the PK) makes
-- this a simple correlated update; multiple funnels per client resolves
-- to the first one a customer created with an offer set.
--
-- Idempotent: only updates brand rows where offer is currently NULL.
update public.brands b
set offer = sub.funnel_offer
from (
  select distinct on (client_id)
    client_id,
    funnel_offer
  from public.funnels
  where funnel_offer is not null
  order by client_id, created_at asc, id asc
) sub
where b.client_id = sub.client_id
  and b.offer is null;
