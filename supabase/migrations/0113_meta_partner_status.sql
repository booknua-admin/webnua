-- =============================================================================
-- 0113_meta_partner_status.sql
--
-- Meta Ads — Business Asset Sharing layer. Adds the columns needed to track
-- whether Webnua's Business Manager has been granted partner access to the
-- customer's ad account + Page, alongside the existing OAuth connection.
--
-- Why this exists: OAuth grants the APP permission to call APIs on the
-- customer's behalf, but it does NOT make Webnua's Business Manager a
-- partner on the customer's ad account. Without partnership, operators
-- clicking "Open Meta Ads Manager" would see their own accounts, not the
-- customer's. With partnership (POST /act_{id}/agencies + POST /{page}/
-- agencies), the customer's assets appear natively in every Webnua
-- operator's own Ads Manager — the standard agency-onboarding shape.
--
-- Six new columns:
--   meta_page_id / meta_page_name             — the Page selected at OAuth time,
--                                                needed for lead-gen ads + Page
--                                                partnership
--   webnua_partner_status                     — ad-account partnership state
--                                                ('pending' | 'active' | 'failed'
--                                                | 'revoked')
--   webnua_partner_granted_at                 — when active
--   webnua_partner_error                      — human-readable last error
--   webnua_page_partner_status                — Page partnership state (same enum)
--   webnua_page_partner_granted_at            — when active
--   webnua_page_partner_error                 — human-readable last error
--
-- Ad-account and Page partnership are tracked independently because they
-- can succeed or fail separately, and the customer may revoke one without
-- the other.
--
-- RLS: unchanged — the existing operator-SELECT / service-role-write policy
-- on client_meta_ad_accounts covers the new columns.
-- =============================================================================

alter table public.client_meta_ad_accounts
  add column if not exists meta_page_id text,
  add column if not exists meta_page_name text,
  add column if not exists webnua_partner_status text
    check (webnua_partner_status in ('pending', 'active', 'failed', 'revoked')),
  add column if not exists webnua_partner_granted_at timestamptz,
  add column if not exists webnua_partner_error text,
  add column if not exists webnua_page_partner_status text
    check (webnua_page_partner_status in ('pending', 'active', 'failed', 'revoked')),
  add column if not exists webnua_page_partner_granted_at timestamptz,
  add column if not exists webnua_page_partner_error text;

comment on column public.client_meta_ad_accounts.meta_page_id is
  'The Facebook Page id picked at OAuth time. Needed for lead-gen ads (each ad attaches to a Page) and for Page partnership sharing.';

comment on column public.client_meta_ad_accounts.webnua_partner_status is
  'State of Webnua Business Manager partner access on the customer ad account. ''active'' means operators see this ad account natively in their own Meta Ads Manager.';

comment on column public.client_meta_ad_accounts.webnua_page_partner_status is
  'State of Webnua Business Manager partner access on the customer Page. ''active'' means operators can run lead-gen ads attached to this Page from their own BM.';
