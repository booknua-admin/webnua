-- =============================================================================
-- Webnua backend — Phase 7 Meta Ads · meta_campaigns.
--
-- The Meta-side record for a campaign Webnua launched (or imported) into a
-- customer's ad account. Distinct from the existing public.campaigns table:
--   • public.campaigns is the Phase 5 operator-facing concept (name,
--     status, activity log). It existed before Meta wiring landed; every
--     surface (the /campaigns hub, the dashboard widget) reads from it.
--   • public.meta_campaigns is the Meta-specific record (Meta's campaign
--     id, daily/lifetime budget, objective, lead-form linkage, sync
--     timestamps).
--
-- THE BRIDGE: every meta_campaigns row carries `campaign_id` FK to
-- public.campaigns(id) — the operator-facing campaign concept. The launch
-- orchestrator inserts BOTH rows in lockstep. The existing /campaigns
-- surface reads from public.campaigns and JOINS to public.meta_campaigns +
-- public.meta_ads_insights when the campaign is Meta-backed; the previously
-- placeholder "Awaiting Meta Ads" metrics are now backed by real numbers
-- when an inner row exists.
--
-- `created_via` distinguishes:
--   • 'webnua_month_1' — the operator launched this within the customer's
--                        first 30 days; the €200 ad-credit accounting
--                        sums spend over these campaigns.
--   • 'webnua_ongoing' — a regular operator-launched campaign (month 2+).
--   • 'external'       — imported from a pre-existing Meta campaign that
--                        Webnua now manages.
--
-- RLS — operator-only tenant-scoped (operators launch + manage; customers
-- see performance via the joined campaigns surface). Service-role writes.
-- =============================================================================

create type meta_campaign_created_via as enum ('webnua_month_1', 'webnua_ongoing', 'external');
create type meta_campaign_status      as enum ('active', 'paused', 'archived', 'in_review', 'with_issues');

create table public.meta_campaigns (
  id                          uuid primary key default gen_random_uuid(),
  client_id                   uuid not null references public.clients (id) on delete cascade,

  /* Bridge to the operator-facing concept. NOT NULL: every Meta campaign
   * MUST have a matching public.campaigns row so the existing surfaces
   * light up. ON DELETE CASCADE keeps the two in lockstep — deleting the
   * concept tears down its Meta record. */
  campaign_id                 uuid not null unique references public.campaigns (id) on delete cascade,

  /* Meta's own identifiers. */
  meta_campaign_id            text not null unique,
  meta_ad_set_id              text,
  meta_ad_id                  text,
  meta_creative_id            text,

  meta_lead_form_id           uuid references public.meta_lead_forms (id) on delete set null,

  campaign_name               text not null,
  objective                   text not null default 'LEAD_GENERATION',   -- V1: lead-gen only
  status                      meta_campaign_status not null default 'in_review',

  daily_budget_cents          bigint,                                    -- minor units
  lifetime_budget_cents       bigint,                                    -- minor units; either/or with daily

  start_date                  date,
  end_date                    date,                                       -- nullable = no end date

  created_via                 meta_campaign_created_via not null default 'webnua_ongoing',

  /* Template provenance — the slug from campaign-templates/ that produced
   * this launch. Diagnostic only; null for 'external' imports. */
  template_slug               text,

  last_synced_at              timestamptz,
  last_insights_synced_at     timestamptz,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index meta_campaigns_client_id_idx
  on public.meta_campaigns (client_id);

create index meta_campaigns_status_idx
  on public.meta_campaigns (status)
  where status in ('active', 'in_review');

create trigger meta_campaigns_set_updated_at
  before update on public.meta_campaigns
  for each row execute function private.set_updated_at();

-- --- RLS ---------------------------------------------------------------------

alter table public.meta_campaigns enable row level security;

create policy meta_campaigns_select on public.meta_campaigns
  for select to authenticated
  using (client_id = any (private.accessible_client_ids()));

-- Writes are service-role only — launch + status + sync all go through the
-- API routes or the sync jobs.
