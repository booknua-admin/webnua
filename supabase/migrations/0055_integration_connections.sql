-- =============================================================================
-- Webnua backend — Phase 7 Session 2 · integration_connections.
--
-- The per-tenant OAuth connection table. One row = one customer's account on
-- one third-party provider that Webnua has OAuth access to. Generic across
-- providers (differentiated by the `provider` column) so GBP, Meta and any
-- future OAuth provider share one table and one code path.
--
-- TWO TOKEN MODELS — the table supports both cleanly (see `token_model`):
--   • refresh_access (Google / GBP) — a short-lived access token (~1h) plus a
--     long-lived refresh token. The refresh token is the persistent secret
--     (-> Vault, `token_secret_id`); the access token is cached in
--     `access_token_cached` and re-minted on demand from the refresh token.
--     `access_token_expires_at` is the CACHED access token's expiry.
--   • long_lived (Meta) — one long-lived access token (~60d), no refresh
--     token. The long-lived token IS the access token AND the persistent
--     secret (-> Vault, `token_secret_id`); `access_token_cached` is NULL.
--     `access_token_expires_at` is the long-lived token's expiry; it is
--     refreshed in place before it lapses (Meta's fb_exchange_token extend).
--
-- SECRETS NEVER LIVE HERE. `token_secret_id` is a Vault secret uuid (0054).
-- `access_token_cached` is the ONLY token in a plain column — a deliberate,
-- bounded exception: it is a ~1h Google access token, useless once expired,
-- and caching it avoids a Vault round-trip + a refresh on every API call. The
-- persistent secret (refresh token / long-lived token) is always in Vault.
--
-- RLS: operators see connections for their accessible clients (junior
-- operators stay inside their assignment — the 0045 cross-tenant discipline);
-- client-role users get NO access at all (a client never sees, nor manages,
-- their own OAuth connections — the operator runs integrations for them).
-- Writes are service-role only (the OAuth callback + tokens.ts) — the 0018
-- default INSERT/UPDATE/DELETE grant to `authenticated` is revoked.
-- =============================================================================

create table public.integration_connections (
  id                        uuid primary key default gen_random_uuid(),
  -- The tenant this connection belongs to. on delete cascade: a connection
  -- has no meaning without its client.
  client_id                 uuid not null references public.clients (id) on delete cascade,
  -- Open-ended on purpose — 'google_business_profile' / 'meta_ads' today; a
  -- future provider is a new value, not a schema change. Validated in app
  -- code against the OAuth provider registry.
  provider                  text not null,
  -- The customer's account id ON THE PROVIDER (GBP account name, Meta user
  -- id). Fetched by the callback after the token exchange.
  provider_account_id       text not null,
  -- Vault secret uuid for the PERSISTENT token (refresh token for Google;
  -- long-lived access token for Meta). NULL only on a revoked connection
  -- whose secret has been deleted.
  token_secret_id           uuid,
  -- refresh_access only: the current short-lived access token, plaintext.
  -- NULL for long_lived (the persistent token in Vault is the access token).
  access_token_cached       text,
  -- Expiry of whichever token is the live access token (cached one for
  -- Google; the long-lived one for Meta).
  access_token_expires_at   timestamptz,
  token_model               text not null
                              check (token_model in ('refresh_access', 'long_lived')),
  scopes                    text[] not null default '{}',
  status                    text not null default 'active'
                              check (status in
                                ('active', 'refresh_failed', 'revoked', 'expired')),
  connected_at              timestamptz not null default now(),
  last_used_at              timestamptz,
  last_refreshed_at         timestamptz,
  -- Human-readable last failure (refresh / revoke error) for the operator UI.
  last_error                text,
  -- Throttle marker for the refresh-failure operator alert — at most one
  -- alert per connection per 24h (see tokens.ts notifyTokenRefreshFailure).
  last_failure_notified_at  timestamptz,
  -- One connection per (client, provider, provider account). A reconnect to
  -- the same account replaces the row (tokens.ts storeConnection); a future
  -- multi-account-per-provider case is already representable.
  unique (client_id, provider, provider_account_id)
);

create index integration_connections_client_idx
  on public.integration_connections (client_id);
-- The token-refresh-check job's scan: active connections near expiry.
create index integration_connections_refresh_idx
  on public.integration_connections (access_token_expires_at)
  where status = 'active';

-- --- RLS ---------------------------------------------------------------------
alter table public.integration_connections enable row level security;

-- Service-role-write only — the OAuth callback and tokens.ts hold the
-- service-role key. The 0018 default grant's write privileges are revoked;
-- SELECT stays (RLS-gated below) so the operator connections UI can read.
revoke insert, update, delete on public.integration_connections from authenticated;

create policy integration_connections_select on public.integration_connections
  for select to authenticated
  using (
    private.is_operator()
    and client_id in (select private.accessible_client_ids())
  );
