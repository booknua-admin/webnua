// =============================================================================
// Token management — Vault-backed storage, on-demand access tokens, revocation.
//
// Phase 7 Session 2. The heart of the per-tenant OAuth foundation. Every
// per-tenant integration gets its access tokens through here; it never sees a
// refresh token or a long-lived secret in plaintext.
//
//   • storeConnection   — encrypt the persistent token into Vault, write the
//                         integration_connections row.
//   • getAccessToken    — return a usable access token, refreshing if needed.
//                         The refresh logic forks on token_model.
//   • revokeConnection  — revoke at the provider, delete the Vault secret,
//                         mark the row revoked.
//
// VAULT FAILURE IS FATAL. If Vault is unavailable, storeConnection throws
// VaultUnavailableError and NO connection row is written — a token is never
// stored in plaintext as a fallback. getAccessToken throws likewise rather
// than returning a stale or missing token.
//
// SERVER-ONLY.
// =============================================================================

import type { OAuthProviderId, TokenModel } from '@/lib/integrations/connections';
import { OAUTH_PROVIDER_DISPLAY } from '@/lib/integrations/connections';

import {
  getIntegrationDb,
  type IntegrationConnectionInsert,
  type IntegrationConnectionRow,
} from './db-types';
import { getOAuthProvider } from './oauth-providers';

const TABLE = 'integration_connections';

// --- errors ------------------------------------------------------------------

/** Base for every error this module throws — callers can catch the family. */
export class IntegrationTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Vault could not be reached / used. The system fails loud rather than
 *  storing or returning an unencrypted token. */
export class VaultUnavailableError extends IntegrationTokenError {}

/** No connection exists for the (client, provider). */
export class ConnectionNotFoundError extends IntegrationTokenError {}

/** The connection's token is past expiry and could not be refreshed. */
export class TokenExpiredError extends IntegrationTokenError {}

/** A token refresh attempt failed — the connection now needs the operator to
 *  reconnect. Thrown by getAccessToken and callWithToken. */
export class TokenRefreshFailedError extends IntegrationTokenError {}

/** The connection has been revoked (by Webnua or by the customer at the
 *  provider) — it must be reconnected before use. */
export class TokenRevokedError extends IntegrationTokenError {}

// --- Vault wrappers ----------------------------------------------------------
// Thin RPC calls onto the migration 0054 wrapper functions. Any failure is a
// VaultUnavailableError — the encryption layer is mandatory, not best-effort.

async function vaultCreateSecret(secret: string, description: string): Promise<string> {
  const { data, error } = await getIntegrationDb().rpc('webnua_vault_create_secret', {
    p_secret: secret,
    p_description: description,
  });
  if (error || typeof data !== 'string' || data.length === 0) {
    throw new VaultUnavailableError(
      `Vault could not store the token: ${error?.message ?? 'no secret id returned'}`,
    );
  }
  return data;
}

async function vaultReadSecret(id: string): Promise<string> {
  const { data, error } = await getIntegrationDb().rpc('webnua_vault_read_secret', {
    p_id: id,
  });
  if (error) {
    throw new VaultUnavailableError(`Vault could not read the token: ${error.message}`);
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new VaultUnavailableError('Vault holds no secret for this connection.');
  }
  return data;
}

async function vaultUpdateSecret(id: string, secret: string): Promise<void> {
  const { error } = await getIntegrationDb().rpc('webnua_vault_update_secret', {
    p_id: id,
    p_secret: secret,
  });
  if (error) {
    throw new VaultUnavailableError(`Vault could not rotate the token: ${error.message}`);
  }
}

/** Best-effort secret delete — a stray encrypted secret is harmless, so a
 *  failure here is logged, never thrown. */
async function vaultDeleteSecretQuiet(id: string): Promise<void> {
  try {
    const { error } = await getIntegrationDb().rpc('webnua_vault_delete_secret', {
      p_id: id,
    });
    if (error) console.warn('[tokens] vault delete_secret failed', error.message);
  } catch (error) {
    console.warn('[tokens] vault delete_secret threw', error);
  }
}

// --- connection row helpers --------------------------------------------------

async function loadConnection(
  clientId: string,
  provider: OAuthProviderId,
): Promise<IntegrationConnectionRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select('*')
    .eq('client_id', clientId)
    .eq('provider', provider)
    .maybeSingle();
  if (error) {
    throw new IntegrationTokenError(`Could not read the connection: ${error.message}`);
  }
  return (data as IntegrationConnectionRow | null) ?? null;
}

async function updateConnection(
  id: string,
  patch: Partial<IntegrationConnectionRow>,
): Promise<void> {
  const { error } = await getIntegrationDb().from(TABLE).update(patch).eq('id', id);
  if (error) {
    throw new IntegrationTokenError(`Could not update the connection: ${error.message}`);
  }
}

/** Delete every connection for a (client, provider), clearing its Vault
 *  secret first. Used by storeConnection so a reconnect replaces cleanly. */
async function deleteConnections(clientId: string, provider: OAuthProviderId): Promise<void> {
  const { data } = await getIntegrationDb()
    .from(TABLE)
    .select('id, token_secret_id')
    .eq('client_id', clientId)
    .eq('provider', provider);
  for (const row of (data ?? []) as Pick<IntegrationConnectionRow, 'id' | 'token_secret_id'>[]) {
    if (row.token_secret_id) await vaultDeleteSecretQuiet(row.token_secret_id);
    await getIntegrationDb().from(TABLE).delete().eq('id', row.id);
  }
}

function expiryFromNow(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

// --- storeConnection ---------------------------------------------------------

export type StoreConnectionParams = {
  clientId: string;
  provider: OAuthProviderId;
  providerAccountId: string;
  /** The persistent secret — refresh token (Google) / long-lived token
   *  (Meta). Encrypted into Vault; never written to a plain column. */
  persistentToken: string;
  /** The current short-lived access token — refresh_access only; null for
   *  long_lived (the persistent token IS the access token there). */
  accessTokenCached: string | null;
  /** Expiry of the live access token. */
  accessTokenExpiresAt: Date;
  tokenModel: TokenModel;
  scopes: string[];
};

/**
 * Persist a freshly-OAuthed connection: encrypt the persistent token into
 * Vault, then write the integration_connections row. Replaces any prior
 * connection for the same (client, provider) — a reconnect supersedes.
 *
 * Throws VaultUnavailableError if encryption fails — no row is written. The
 * just-created Vault secret is cleaned up if the row insert then fails.
 */
export async function storeConnection(
  params: StoreConnectionParams,
): Promise<{ connectionId: string }> {
  // Replace any existing connection (and its secret) first.
  await deleteConnections(params.clientId, params.provider);

  // Encrypt the persistent token. If this throws, nothing is written.
  const secretId = await vaultCreateSecret(
    params.persistentToken,
    `Webnua OAuth ${params.provider} token · client ${params.clientId}`,
  );

  const insert: IntegrationConnectionInsert = {
    client_id: params.clientId,
    provider: params.provider,
    provider_account_id: params.providerAccountId,
    token_secret_id: secretId,
    access_token_cached: params.accessTokenCached,
    access_token_expires_at: params.accessTokenExpiresAt.toISOString(),
    token_model: params.tokenModel,
    scopes: params.scopes,
    status: 'active',
  };
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .insert(insert)
    .select('id')
    .single();
  if (error || !data) {
    // The row failed — do not leave the secret orphaned in Vault.
    await vaultDeleteSecretQuiet(secretId);
    throw new IntegrationTokenError(
      `Could not store the connection: ${error?.message ?? 'no row returned'}`,
    );
  }
  return { connectionId: (data as { id: string }).id };
}

// --- getAccessToken ----------------------------------------------------------

// On-demand refresh fires once the cached access token is within this of
// expiry — a small buffer so a token is not handed out moments before it dies.
const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60_000;
// A long-lived (Meta) token is refreshed in place once it is within this of
// expiry. The daily job (14d window) is the proactive net ahead of this.
const LONG_LIVED_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type GetAccessTokenOptions = {
  /** Refresh regardless of the cached token's clock expiry — used after a
   *  provider returns 401 (the token is bad even if not clock-expired). */
  forceRefresh?: boolean;
};

/**
 * Return a usable access token for a (client, provider), refreshing if needed.
 *
 *   • refresh_access (Google) — hands back the cached access token while it is
 *     still fresh; otherwise mints a new one from the Vault refresh token.
 *   • long_lived (Meta) — the Vault secret IS the access token; it is refreshed
 *     in place when within 7 days of expiry.
 *
 * Throws ConnectionNotFoundError / TokenRevokedError / TokenRefreshFailedError
 * / TokenExpiredError so callers can react precisely.
 */
export async function getAccessToken(
  clientId: string,
  provider: OAuthProviderId,
  options: GetAccessTokenOptions = {},
): Promise<string> {
  const conn = await loadConnection(clientId, provider);
  if (!conn) {
    throw new ConnectionNotFoundError(`No ${provider} connection for client ${clientId}.`);
  }
  if (conn.status === 'revoked') {
    throw new TokenRevokedError(`The ${provider} connection has been revoked — reconnect it.`);
  }
  if (!conn.token_secret_id) {
    throw new IntegrationTokenError(`The ${provider} connection has no stored secret.`);
  }

  return conn.token_model === 'refresh_access'
    ? getRefreshAccessToken(conn, options)
    : getLongLivedToken(conn, options);
}

/** refresh_access (Google): cached short-lived token, re-minted from the
 *  Vault refresh token when stale. */
async function getRefreshAccessToken(
  conn: IntegrationConnectionRow,
  options: GetAccessTokenOptions,
): Promise<string> {
  const expiresAtMs = conn.access_token_expires_at
    ? Date.parse(conn.access_token_expires_at)
    : 0;
  const stillFresh = expiresAtMs - Date.now() > ACCESS_TOKEN_EXPIRY_BUFFER_MS;
  if (!options.forceRefresh && conn.access_token_cached && stillFresh) {
    return conn.access_token_cached;
  }

  // Mint a new access token from the refresh token.
  const refreshToken = await vaultReadSecret(conn.token_secret_id as string);
  try {
    const result = await getOAuthProvider(conn.provider).refreshToken({
      persistentToken: refreshToken,
      tenantId: conn.client_id,
    });
    await updateConnection(conn.id, {
      access_token_cached: result.accessToken,
      access_token_expires_at: expiryFromNow(result.expiresIn),
      last_refreshed_at: new Date().toISOString(),
      status: 'active',
      last_error: null,
    });
    return result.accessToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markRefreshFailed(conn, message);
    await notifyTokenRefreshFailure(conn);
    throw new TokenRefreshFailedError(
      `Could not refresh the ${conn.provider} token for client ${conn.client_id}: ${message}`,
    );
  }
}

/** long_lived (Meta): the Vault secret is the access token; refreshed in
 *  place ("extended") when within the refresh window. */
async function getLongLivedToken(
  conn: IntegrationConnectionRow,
  options: GetAccessTokenOptions,
): Promise<string> {
  const token = await vaultReadSecret(conn.token_secret_id as string);
  const expiresAtMs = conn.access_token_expires_at
    ? Date.parse(conn.access_token_expires_at)
    : 0;
  const expiringSoon = expiresAtMs - Date.now() < LONG_LIVED_REFRESH_WINDOW_MS;
  if (!options.forceRefresh && !expiringSoon) {
    return token;
  }

  try {
    const result = await getOAuthProvider(conn.provider).refreshToken({
      persistentToken: token,
      tenantId: conn.client_id,
    });
    const next = result.newPersistentToken ?? result.accessToken;
    // The long-lived token rotated — rotate the Vault secret in place.
    await vaultUpdateSecret(conn.token_secret_id as string, next);
    await updateConnection(conn.id, {
      access_token_expires_at: expiryFromNow(result.expiresIn),
      last_refreshed_at: new Date().toISOString(),
      status: 'active',
      last_error: null,
    });
    return next;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stillValid = expiresAtMs > Date.now();
    // A failed extend while the token is still clock-valid is transient — the
    // existing token still works; surface a warning, try again next cycle.
    if (!options.forceRefresh && stillValid) {
      console.warn(
        `[tokens] could not extend the ${conn.provider} token for client ` +
          `${conn.client_id} (still valid, will retry): ${message}`,
      );
      return token;
    }
    await markRefreshFailed(conn, message);
    await notifyTokenRefreshFailure(conn);
    throw new TokenRefreshFailedError(
      `Could not refresh the ${conn.provider} token for client ${conn.client_id}: ${message}`,
    );
  }
}

async function markRefreshFailed(
  conn: IntegrationConnectionRow,
  message: string,
): Promise<void> {
  await updateConnection(conn.id, {
    status: 'refresh_failed',
    last_error: message.slice(0, 500),
  });
}

// --- revokeConnection --------------------------------------------------------

/**
 * Disconnect a (client, provider): revoke at the provider (best-effort),
 * delete the Vault secret, and mark the row revoked. A revoked row is kept
 * for audit — the connections UI treats it as "not connected".
 *
 * A no-op when no connection exists (already disconnected).
 */
export async function revokeConnection(
  clientId: string,
  provider: OAuthProviderId,
): Promise<void> {
  const conn = await loadConnection(clientId, provider);
  if (!conn || conn.status === 'revoked') return;

  // Best-effort revoke at the provider — the operator's intent is to
  // disconnect, so local cleanup proceeds even if the provider call fails.
  if (conn.token_secret_id) {
    try {
      const persistentToken = await vaultReadSecret(conn.token_secret_id);
      await getOAuthProvider(provider).revoke({
        persistentToken,
        providerAccountId: conn.provider_account_id,
        tenantId: clientId,
      });
    } catch (error) {
      console.warn(
        `[tokens] provider revoke failed for ${provider} / client ${clientId} ` +
          `(continuing with local cleanup):`,
        error,
      );
    }
    await vaultDeleteSecretQuiet(conn.token_secret_id);
  }

  await updateConnection(conn.id, {
    status: 'revoked',
    token_secret_id: null,
    access_token_cached: null,
    last_error: null,
  });
}

// --- last-used touch ---------------------------------------------------------

/** Best-effort `last_used_at` bump after a successful per-tenant API call. */
export async function touchConnectionUsed(
  clientId: string,
  provider: OAuthProviderId,
): Promise<void> {
  try {
    await getIntegrationDb()
      .from(TABLE)
      .update({ last_used_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .eq('provider', provider);
  } catch (error) {
    console.warn('[tokens] last_used_at touch failed', error);
  }
}

// --- refresh-failure notification --------------------------------------------

// One operator alert per connection per 24h — a broken connection should not
// re-alert every time a call hits it.
const FAILURE_NOTIFY_THROTTLE_MS = 24 * 60 * 60 * 1000;

/**
 * Alert the operator that a connection's token refresh failed and it needs
 * reconnecting. Throttled to once per connection per 24h via the
 * `last_failure_notified_at` column.
 *
 * V1 DELIVERY. Webnua has no operator in-app notification feed, and the
 * operator email path (Resend) is wired in a later Phase 7 session. So V1
 * delivery is a structured server-log line plus the connection's
 * `refresh_failed` status + `last_error`, which the operator connections UI
 * surfaces directly with a "Reconnect" affordance — that UI is the real
 * operator-facing surface. When Resend is wired, swap the console.warn for a
 * notifications_outbound-logged email; the throttle + composed message are
 * already here.
 *
 * Never throws — a notification failure must not mask the real token error.
 */
export async function notifyTokenRefreshFailure(
  conn: IntegrationConnectionRow,
): Promise<void> {
  try {
    const lastNotifiedMs = conn.last_failure_notified_at
      ? Date.parse(conn.last_failure_notified_at)
      : 0;
    if (Date.now() - lastNotifiedMs < FAILURE_NOTIFY_THROTTLE_MS) return;

    const { data: client } = await getIntegrationDb()
      .from('clients')
      .select('name')
      .eq('id', conn.client_id)
      .maybeSingle();
    const clientName = (client as { name?: string } | null)?.name ?? conn.client_id;
    const providerName = OAUTH_PROVIDER_DISPLAY[conn.provider].name;

    console.warn(
      `[operator-alert] ${clientName} disconnected ${providerName}. ` +
        `Reconnect it in Settings → Integrations (sub-account · ${clientName}).`,
    );

    await getIntegrationDb()
      .from(TABLE)
      .update({ last_failure_notified_at: new Date().toISOString() })
      .eq('id', conn.id);
  } catch (error) {
    console.warn('[tokens] notifyTokenRefreshFailure failed', error);
  }
}
