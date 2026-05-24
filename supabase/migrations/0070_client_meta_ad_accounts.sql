-- =============================================================================
-- Webnua backend — Phase 7 Meta Ads · client_meta_ad_accounts.
--
-- Per-client mapping of "which Meta ad account does Webnua manage for this
-- client". Filled at post-OAuth time when the operator picks one of the ad
-- accounts the customer's connected Facebook user has access to. The OAuth
-- token itself lives on integration_connections (provider = 'meta_ads',
-- token_model = 'long_lived'); this table is the BUSINESS-LOGIC selection on
-- top of that token.
--
-- V1 FORCING FUNCTION: ONE ad account per client (UNIQUE on client_id),
-- mirroring client_gbp_locations from migration 0066. Multi-ad-account
-- clients (e.g. an agency-of-an-agency) would loosen this + add a `primary`
-- flag. Defer until a real customer needs it.
--
-- RLS — operator-only tenant-scoped (this is operator-managed plumbing;
-- the customer doesn't pick their own ad account, the operator does).
-- Service-role writes from the post-OAuth ad-account picker route.
-- =============================================================================

create table public.client_meta_ad_accounts (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null unique references public.clients (id) on delete cascade,

  -- Meta's identifiers. The ad account id is the "act_NNNNN" form (the
  -- API returns it as the `id` field on /me/adaccounts and accepts both
  -- the bare numeric id and the `act_` prefix on most endpoints; we store
  -- with the prefix so calls don't have to reconstruct it).
  meta_ad_account_id    text not null,
  meta_business_id      text,
  meta_user_id          text,

  -- Display + posture (refreshed by getAdAccount).
  ad_account_name       text,
  currency              text,                           -- ISO 4217, e.g. 'EUR'
  account_status        integer,                        -- Meta's numeric status
  amount_spent_cents    bigint,                         -- as last seen
  balance_cents         bigint,                         -- prepaid funding balance, when known
  timezone_name         text,

  -- Operator-authorised customer agreement snapshot (captured at picker
  -- time). The customer must explicitly agree before we run any spend on
  -- their account. Stored here for audit (who agreed, when).
  customer_agreed_at        timestamptz,
  customer_agreed_by_email  text,

  last_synced_at        timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index client_meta_ad_accounts_meta_ad_account_id_idx
  on public.client_meta_ad_accounts (meta_ad_account_id);

create function private.client_meta_ad_accounts_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger client_meta_ad_accounts_set_updated_at
  before update on public.client_meta_ad_accounts
  for each row execute function private.client_meta_ad_accounts_touch_updated_at();

-- --- RLS ---------------------------------------------------------------------

alter table public.client_meta_ad_accounts enable row level security;
revoke insert, update, delete on public.client_meta_ad_accounts from authenticated;

-- Operators see ad accounts for their accessible clients; clients see their
-- own ad-account assignment (the "Meta is connected" dashboard widget reads
-- this — the customer should know which account is being managed).
create policy client_meta_ad_accounts_select on public.client_meta_ad_accounts
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));

-- Writes are service-role only — every insert/update goes through the
-- post-OAuth ad-account picker route, never a direct user write.
