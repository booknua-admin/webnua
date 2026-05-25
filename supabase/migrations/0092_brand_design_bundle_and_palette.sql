-- =============================================================================
-- Bundle C2b-1 — design bundles + derived palette.
--
-- Two nullable columns on `public.brands` that hold the customer's design
-- decisions:
--
--   design_bundle_id text NULL
--     One of the 4 design-bundle keys (closed set, application-enforced):
--       'sharp_direct' | 'warm_established' | 'clean_premium' | 'bold_direct'
--     NULL = inherit the industry default (lib/website/industry-bundle-defaults.ts).
--     No FK or CHECK constraint — the application is the source of truth for
--     the closed value set so we can add a 5th bundle later without a
--     migration. Adding a CHECK costs more than it pays here.
--
--   derived_palette jsonb NULL
--     The full derived colour palette (primary tints/shades + secondary +
--     neutrals + surfaces + status tints + WCAG-validated text colours).
--     Computed once at brand-create time and re-computed on every brand-
--     colour edit (lib/website/brand-style.ts). NULL = legacy row pre-C2;
--     readers must tolerate a missing palette by re-deriving from
--     accent_color at render time (lib/website/color-derivation.ts has the
--     same function the writers call).
--
-- RLS: no new policies needed. The existing brands_select / brands_update
-- policies (0088) cover these columns — operators see all accessible-client
-- rows; owners with `editTheme` cap update their own.
-- =============================================================================

alter table public.brands
  add column if not exists design_bundle_id text,
  add column if not exists derived_palette jsonb;

comment on column public.brands.design_bundle_id is
  'Closed set: sharp_direct | warm_established | clean_premium | bold_direct. NULL = inherit industry default. Application-enforced; no CHECK.';
comment on column public.brands.derived_palette is
  'Cached derived colour palette computed by lib/website/color-derivation.ts. NULL = re-derive at render time.';
