-- =============================================================================
-- Webnua backend — Phase 7 Session 2 · Supabase Vault setup.
--
-- Per-tenant OAuth integrations (GBP, Meta) store a long-lived secret per
-- connection — a Google refresh token, a Meta long-lived access token. These
-- are the crown jewels: a leaked refresh token is standing access to the
-- customer's account. They are NEVER stored in a plain column.
--
-- Encryption: Supabase Vault (operator-locked decision). Vault holds the
-- secret encrypted at rest (authenticated encryption); the connection row
-- stores only the secret's uuid (`integration_connections.token_secret_id`).
--
-- Why wrapper functions. Vault lives in the `vault` schema, which PostgREST
-- does not expose — the Supabase JS client cannot reach `vault.create_secret`
-- or `vault.decrypted_secrets` directly. This migration adds four thin
-- wrappers in `public` (PostgREST-reachable). They are SECURITY DEFINER so
-- they run with rights to touch `vault`, and EXECUTE is revoked from every
-- role EXCEPT `service_role` — only server code holding the service-role key
-- (src/lib/integrations/_shared/tokens.ts) can mint, read, rotate or delete a
-- secret. A signed-in operator or client can NOT call them.
--
-- FALLBACK IF VAULT IS UNAVAILABLE. Supabase Vault is enabled on every hosted
-- project (the `supabase_vault` extension; verified present on this project
-- at 0.3.1). If a future self-hosted / bespoke deployment genuinely lacks it,
-- the documented fallback is pgsodium envelope encryption: enable `pgsodium`,
-- create a key, and replace the wrapper bodies with
-- `pgsodium.crypto_aead_det_encrypt` / `_decrypt` using a master key held in
-- an env var (NOT in the database). The application contract — four wrapper
-- functions returning / taking a `uuid` handle — does not change, so only
-- this migration is touched. The wrappers MUST fail loud if encryption is
-- unavailable: tokens.ts treats any error here as fatal and never falls back
-- to storing a plaintext token.
-- =============================================================================

-- Vault ships enabled on Supabase hosted projects; this is idempotent and a
-- no-op there. On a deployment without it, this line fails loud — which is
-- correct: there is nothing to silently degrade to.
create extension if not exists supabase_vault with schema vault;

-- --- wrapper: create a secret -------------------------------------------------
-- Returns the new secret's uuid — stored on integration_connections.
-- token_secret_id. `new_name` is left NULL so Vault auto-keys the row; the
-- description is human-facing only.
create or replace function public.webnua_vault_create_secret(
  p_secret      text,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select vault.create_secret(p_secret, null, p_description) into v_id;
  return v_id;
end;
$$;

-- --- wrapper: read (decrypt) a secret -----------------------------------------
create or replace function public.webnua_vault_read_secret(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

-- --- wrapper: rotate a secret's value -----------------------------------------
-- Used when a long-lived token is refreshed in place (Meta — the persistent
-- token itself changes on every extend).
create or replace function public.webnua_vault_update_secret(
  p_id     uuid,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform vault.update_secret(p_id, p_secret);
end;
$$;

-- --- wrapper: delete a secret -------------------------------------------------
-- Called when a connection is revoked or replaced — the old secret must not
-- outlive the connection row.
create or replace function public.webnua_vault_delete_secret(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = p_id;
end;
$$;

-- --- lockdown ----------------------------------------------------------------
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and Supabase's default
-- privileges also grant it to `anon` / `authenticated`. Revoke from all three
-- — only `service_role` (server code) may touch Vault.
revoke all on function public.webnua_vault_create_secret(text, text)  from public, anon, authenticated;
revoke all on function public.webnua_vault_read_secret(uuid)          from public, anon, authenticated;
revoke all on function public.webnua_vault_update_secret(uuid, text)  from public, anon, authenticated;
revoke all on function public.webnua_vault_delete_secret(uuid)        from public, anon, authenticated;

grant execute on function public.webnua_vault_create_secret(text, text) to service_role;
grant execute on function public.webnua_vault_read_secret(uuid)         to service_role;
grant execute on function public.webnua_vault_update_secret(uuid, text) to service_role;
grant execute on function public.webnua_vault_delete_secret(uuid)       to service_role;
