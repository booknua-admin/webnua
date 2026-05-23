-- =============================================================================
-- Webnua backend — Phase 7 GBP · client_gbp_locations.
--
-- Per-tenant OAuth: Webnua's GBP integration is per-customer (the customer's
-- own GBP account, OAuth-connected through integration_connections). After
-- the OAuth callback succeeds the operator picks WHICH Google Business
-- Profile location (a Google account can manage multiple) to associate with
-- this Webnua client; that selection is the row here.
--
-- One row per client (UNIQUE on client_id) — V1 supports one connected
-- location per client. A future multi-location client (an electrician
-- running two suburbs) needs the unique loosened + a "primary" flag.
--
-- The resource-name pair (gbp_account_id, gbp_location_id) is what the
-- GBP API takes: "accounts/{accountId}" + "locations/{locationId}". Stored
-- as the resource names (with the prefixes) so the API calls can use them
-- straight without re-formatting.
--
-- current_rating / review_count cache the headline numbers so the operator
-- dashboard widget doesn't hit Google on every render. Refreshed by the
-- daily gbp_sync_reviews job (migration 0069).
--
-- review_link is the GBP "leave a review" deep-link — populated when we
-- read the location detail from GBP. The send_sms / send_email job's
-- buildRenderContext pulls this for {{review.link}} substitution.
--
-- RLS: operators see their accessible clients' locations; client-role users
-- see their own row. Writes are service-role only — the operator UI POSTs
-- to the /api/integrations/google_business_profile/locations route which
-- runs against the service-role client.
-- =============================================================================

create table public.client_gbp_locations (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- One location per client (V1 forcing-function).
  client_id          uuid not null unique references public.clients (id) on delete cascade,

  -- The Google resource names — full strings with prefix (e.g.
  --   "accounts/123456789" / "locations/987654321").
  gbp_account_id     text not null check (gbp_account_id like 'accounts/%'),
  gbp_location_id    text not null check (gbp_location_id like 'locations/%'),

  -- Cached location detail — refreshed by the sync job.
  location_title     text not null default '',
  address            text,
  phone              text,
  website            text,
  review_link        text,

  -- Cached headline metrics.
  current_rating     numeric(2, 1) check (current_rating is null or (current_rating >= 0 and current_rating <= 5)),
  review_count       integer not null default 0 check (review_count >= 0),

  last_synced_at     timestamptz
);

create index client_gbp_locations_synced_idx
  on public.client_gbp_locations (last_synced_at nulls first);

-- --- updated_at trigger ------------------------------------------------------
create function private.client_gbp_locations_touch_updated_at()
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

create trigger client_gbp_locations_set_updated_at
  before update on public.client_gbp_locations
  for each row execute function private.client_gbp_locations_touch_updated_at();

-- --- RLS ---------------------------------------------------------------------
alter table public.client_gbp_locations enable row level security;
revoke insert, update, delete on public.client_gbp_locations from authenticated;

create policy client_gbp_locations_select on public.client_gbp_locations
  for select to authenticated
  using (client_id in (select private.accessible_client_ids()));
