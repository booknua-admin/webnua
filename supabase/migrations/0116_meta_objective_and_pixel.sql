-- =============================================================================
-- 0116_meta_objective_and_pixel.sql
--
-- Phase 7.5 · Session 1.2 — campaign objective picker + Meta Pixel
-- auto-detect for the landing-page objective.
--
-- Two columns:
--
--   • meta_campaign_launches.campaign_objective text
--       Closed set: 'lead_form_meta' | 'lead_form_landing'.
--         'lead_form_meta'    — Meta's native instant lead form. Best
--                               default; visitor never leaves Meta.
--         'lead_form_landing' — Ad sends the visitor to the customer's
--                               website; the form-builder form fires
--                               Meta Pixel `Lead` event on submit;
--                               Meta's ad-set carries promoted_object
--                               { pixel_id, custom_event_type: 'LEAD' }
--                               so Meta optimises against the Lead
--                               conversion.
--       Defaults to 'lead_form_meta' for back-compat — every existing
--       row was captured pre-Session-1.2 when only the Meta lead form
--       path existed.
--
--   • client_meta_ad_accounts.meta_pixel_id text
--       The operator-selected pixel for the customer's ad account. NULL
--       until the operator picks one in the launch wizard. The
--       PublicSiteRenderer reads this column to inject the `fbq(init)`
--       snippet on the customer's published site so `Lead` events fire
--       through the right pixel.
--       V1: one pixel per client. Multi-pixel ad accounts (rare for
--       local-service trades) will need a per-campaign override later.
-- =============================================================================

-- --- campaign_objective ------------------------------------------------------

alter table public.meta_campaign_launches
  add column if not exists campaign_objective text not null default 'lead_form_meta';

alter table public.meta_campaign_launches
  add constraint meta_campaign_launches_objective_check
  check (campaign_objective in ('lead_form_meta', 'lead_form_landing'));

comment on column public.meta_campaign_launches.campaign_objective is
  'Closed set: lead_form_meta (Meta instant lead form) | lead_form_landing (Meta Pixel-tracked form on the customer''s website). Frozen at launch alongside the rest of the launch snapshot.';

-- --- client_meta_ad_accounts.meta_pixel_id -----------------------------------

alter table public.client_meta_ad_accounts
  add column if not exists meta_pixel_id text;

comment on column public.client_meta_ad_accounts.meta_pixel_id is
  'Operator-selected Meta Pixel id for this client. NULL until picked in the launch wizard. The PublicSiteRenderer injects the fbq(init) snippet using this id so Lead events fire to the right pixel.';
