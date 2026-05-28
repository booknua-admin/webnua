-- =============================================================================
-- 0115_meta_campaign_launches_and_creatives.sql
--
-- Templated in-app Meta-campaign launch (Phase 7.5 · Session 1).
--
-- Two new tables capture what every launch produces so the data is shaped
-- for cross-tenant performance analysis from day one:
--
--   • meta_campaign_launches — one row per campaign at launch. Frozen
--     snapshot of (template_slug, targeting spec, brief context) so a
--     later edit to brand/clients can't retroactively shift the
--     correlation between launch context and outcome. brief_snapshot is
--     the full brand row + key clients fields (industry, service_area,
--     business name) at launch time.
--
--   • meta_ad_creatives — one row per creative VERSION on a campaign.
--     Session 1 writes the first version; Session 4's refresh flow
--     flips ended_at on the active row and writes a new active one.
--     This is what enables per-creative outcome attribution (join on
--     date_recorded BETWEEN started_at AND ended_at against
--     meta_ads_insights).
--
-- Both tables are operator + own-client SELECT (via the existing
-- accessible_client_ids() helper). Writes are service-role only — the
-- launch orchestrator + refresh handler run service-role.
--
-- Cross-tenant aggregation pipeline + the training model are deferred
-- (Phase 11+); the only point of these tables in Session 1 is to capture
-- the data so it exists when that work lands.
-- =============================================================================

-- --- meta_campaign_launches --------------------------------------------------

create table public.meta_campaign_launches (
  id                       uuid primary key default gen_random_uuid(),
  meta_campaign_id         uuid not null unique references public.meta_campaigns (id) on delete cascade,
  client_id                uuid not null references public.clients (id) on delete cascade,

  -- Template identity (matches IndustryKey + a free-form variant slot
  -- for V1.1's a/b/c bundle splits; nullable for "no specific variant").
  template_slug            text not null,
  template_variant         text,

  -- Targeting spec — frozen at launch (Meta-side edits don't backfill).
  -- geo_center is { lat, lng } jsonb when a lat/long was used; null when
  -- only country-level targeting was applied.
  targeting_geo_center     jsonb,
  targeting_radius_km      integer,
  targeting_age_min        integer not null default 18,
  targeting_age_max        integer not null default 65,
  targeting_interest_tokens text[] not null default '{}',
  targeting_countries      text[] not null default '{}',
  -- Full targeting spec as sent to Meta — captured verbatim so future
  -- training can extract features we didn't think to break out today
  -- (placements, custom audiences, etc.).
  targeting_full_spec      jsonb not null,

  -- Brief snapshot — the brand row + relevant clients fields frozen at
  -- launch. Shape (jsonb):
  --   { brand: { industry_category, services, top_jobs_to_be_booked,
  --             voice_formality, voice_urgency, voice_technicality,
  --             audience_line, accent_color, offer, tagline },
  --     client: { industry, service_area, name } }
  -- No PII in the snapshot (no email / phone / address): training set
  -- correlates context features with outcomes, not customer identity.
  brief_snapshot           jsonb not null,

  -- Operator who launched + audit fields.
  launched_by_user_id      uuid references public.users (id) on delete set null,
  launched_at              timestamptz not null default now(),

  -- Operator-flagged: is this the first campaign Webnua launched for
  -- this customer? Drives the month-1 created_via tagging on
  -- meta_campaigns. The label is operator-facing only — no marketing
  -- claim ('€200 credit' / etc.) is encoded here.
  is_first_launch          boolean not null default false,

  created_at               timestamptz not null default now()
);

create index meta_campaign_launches_client_idx
  on public.meta_campaign_launches (client_id, launched_at desc);

create index meta_campaign_launches_template_idx
  on public.meta_campaign_launches (template_slug);

alter table public.meta_campaign_launches enable row level security;

create policy meta_campaign_launches_select on public.meta_campaign_launches
  for select using (client_id in (select private.accessible_client_ids()));

-- No insert/update/delete policies: service-role only.

comment on table public.meta_campaign_launches is
  'Frozen snapshot of (template + targeting + brief context) at the moment a Meta campaign was launched. Powers cross-tenant performance analysis without joining to live brand/client rows that may have drifted.';

-- --- meta_ad_creatives -------------------------------------------------------
--
-- One row per creative version a campaign has run. Session 1 inserts the
-- initial version; Session 4's refresh flow inserts subsequent versions
-- and stamps ended_at on the prior active row.
--
-- A creative's "outcomes" are derived by joining meta_ads_insights to
-- this table on (date_recorded BETWEEN started_at AND ended_at) — Meta's
-- daily insights stay campaign-level, but the active creative on a given
-- day can be resolved deterministically.

create table public.meta_ad_creatives (
  id                  uuid primary key default gen_random_uuid(),
  meta_campaign_id    uuid not null references public.meta_campaigns (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete cascade,

  -- The creative's lifetime window on this campaign.
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,

  -- Meta-side identifiers (snake_case mirrors meta_campaigns conventions).
  meta_ad_id          text,
  meta_creative_id    text,
  meta_image_hash     text,

  -- Image asset — the original lives in Supabase Storage so Session 4's
  -- refresh-proposal flow can compare against it without depending on
  -- Meta CDN URLs (which expire). image_dimensions is optional metadata
  -- for later vectorisation (training extracts features from the URL).
  image_url           text not null,
  image_width         integer,
  image_height        integer,

  -- Copy that ran. Headline ≤ 45 chars, primary_text ≤ 125, description
  -- ≤ 25 per Meta limits at the time of writing — not enforced in the
  -- schema (Meta's limits drift) but the wizard validates client-side.
  headline            text not null,
  primary_text        text not null,
  description         text,
  cta_type            text not null default 'LEARN_MORE',

  -- Who created this creative — the operator on launch (Session 1) or
  -- on refresh (Session 4).
  created_by_user_id  uuid references public.users (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index meta_ad_creatives_campaign_idx
  on public.meta_ad_creatives (meta_campaign_id, started_at desc);

create index meta_ad_creatives_client_idx
  on public.meta_ad_creatives (client_id, created_at desc);

-- Active creative lookup — at most one row per campaign with ended_at IS NULL.
create unique index meta_ad_creatives_one_active_per_campaign
  on public.meta_ad_creatives (meta_campaign_id)
  where ended_at is null;

alter table public.meta_ad_creatives enable row level security;

create policy meta_ad_creatives_select on public.meta_ad_creatives
  for select using (client_id in (select private.accessible_client_ids()));

-- No insert/update/delete policies: service-role only.

comment on table public.meta_ad_creatives is
  'Every creative version that has run on a Meta campaign. The active row has ended_at IS NULL (enforced by the partial unique index). Session 4''s creative refresh stamps ended_at on the prior active row and inserts a new active one. Per-creative outcomes are derived by joining meta_ads_insights on date_recorded BETWEEN started_at AND ended_at.';
