-- =============================================================================
-- Webnua backend — Phase 7 Meta Ads · meta_ads_insights.
--
-- Daily performance data per Meta campaign. Upserted by the
-- `meta_sync_insights` job (cron, daily at 04:00 UTC; see 0074).
--
-- One row per (meta_campaign_id, date_recorded). The unique constraint is
-- what makes upsert-on-conflict trivial — re-fetching a date overwrites
-- the row rather than duplicating.
--
-- Powers:
--   • the /campaigns hub's per-row sparkline (28-day trend)
--   • the dashboard "Meta ads — spent €X, Y leads, €CPL CPL" widget
--   • the Webnua-internal month-1 ad-credit accounting (sum spend over
--     created_via='webnua_month_1' campaigns)
--
-- RLS — operators see all for their accessible clients; clients see their
-- own (the customer dashboard widget reads this directly).
-- =============================================================================

create table public.meta_ads_insights (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients (id) on delete cascade,
  meta_campaign_id    uuid not null references public.meta_campaigns (id) on delete cascade,

  date_recorded       date not null,

  impressions         bigint not null default 0,
  clicks              bigint not null default 0,
  leads               integer not null default 0,
  spend_cents         bigint not null default 0,                -- minor units
  cpl_cents           bigint,                                    -- minor units; null when leads=0
  ctr_bps             integer,                                   -- basis points (CTR * 10000); null when impressions=0

  /* Raw Meta insights payload (kept for diagnostics + future metric
   * extraction without re-pulling). Compact enough at one row per day
   * per campaign that the storage cost is negligible. */
  raw_payload         jsonb,

  synced_at           timestamptz not null default now(),

  unique (meta_campaign_id, date_recorded)
);

create index meta_ads_insights_client_id_date_idx
  on public.meta_ads_insights (client_id, date_recorded desc);

create index meta_ads_insights_campaign_date_idx
  on public.meta_ads_insights (meta_campaign_id, date_recorded desc);

-- --- RLS ---------------------------------------------------------------------

alter table public.meta_ads_insights enable row level security;
revoke insert, update, delete on public.meta_ads_insights from authenticated;

create policy meta_ads_insights_select on public.meta_ads_insights
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- Writes are service-role only — every insert/upsert goes through the
-- meta_sync_insights job handler.
