-- =============================================================================
-- 0118_meta_matrix_launches.sql
--
-- Phase 7.5 · Session 1.4a — matrix testing (M copy × N images).
--
-- Session 1.3 launched N copy variants as N ads inside ONE ad set; Meta
-- picked a winner per ad set. The matrix model decomposes that further:
--
--   • One AD SET per copy variant (M ad sets total). Each ad set
--     carries the same audience + budget pool but a different headline /
--     primary text / description / CTA.
--   • One AD per image inside each ad set (N ads per set). Meta picks
--     the best image WITHIN each ad set.
--
-- Total ads on launch = M × N. CBO (Campaign Budget Optimization) at the
-- campaign level lets Meta allocate spend ACROSS ad sets, finding the
-- winning copy automatically. The operator's job becomes "turn off the
-- losers" — Session 1.5+ adds the AI ad-management layer that surfaces
-- which cells are underperforming.
--
-- For per-cell outcome attribution, every `meta_ad_creatives` row now
-- carries its ad set id + its copy-variant index + its image-variant
-- index. Joining against `meta_ads_insights` (per-day per-campaign
-- rollup) is still the model — V1.5+ will add per-ad-set insights if
-- the rollup matrix needs finer granularity.
-- =============================================================================

alter table public.meta_ad_creatives
  add column if not exists meta_ad_set_id text;

alter table public.meta_ad_creatives
  add column if not exists copy_variant_index smallint not null default 0;

alter table public.meta_ad_creatives
  add column if not exists image_variant_index smallint not null default 0;

create index if not exists meta_ad_creatives_matrix_idx
  on public.meta_ad_creatives (meta_campaign_id, copy_variant_index, image_variant_index);

comment on column public.meta_ad_creatives.meta_ad_set_id is
  'Meta ad-set id this creative is attached to. Session 1.4+: one ad set per copy variant. Nullable for pre-1.4 rows.';

comment on column public.meta_ad_creatives.copy_variant_index is
  'Which copy variant (0-based) this creative carries. Identifies the ad-set axis of the M × N matrix.';

comment on column public.meta_ad_creatives.image_variant_index is
  'Which image variant (0-based) this creative carries. Identifies the ad axis (within an ad set) of the M × N matrix.';
