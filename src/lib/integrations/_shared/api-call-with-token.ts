// =============================================================================
// callWithToken — the per-tenant API-call wrapper.
//
// Phase 7 Session 2. Every per-tenant integration (GBP, Meta) makes its API
// calls through this. It pairs a fresh access token with the caller's request
// and handles the one cross-cutting concern of token-authenticated calls: a
// 401 means the token went bad mid-life, so refresh once and retry.
//
//   const result = await callWithToken(clientId, 'google_business_profile',
//     (accessToken) => callExternal({ provider: 'google_business_profile',
//       operation: 'list_reviews', url, headers: { Authorization:
//       `Bearer ${accessToken}` }, clientId }));
//
// The caller's fetchFn does the actual HTTP through callExternal() — so the
// call is timed, retried on 5xx, and logged to integration_call_log. This
// wrapper adds ONLY the token lifecycle on top.
//
// SERVER-ONLY.
// =============================================================================

import type { OAuthProviderId } from '@/lib/integrations/connections';

import type { IntegrationResult } from './call';
import { getAccessToken, touchConnectionUsed, TokenRefreshFailedError } from './tokens';

/**
 * Run a per-tenant API call with a fresh access token.
 *
 * Gets the connection's current access token, runs `fetchFn` with it, and —
 * if the provider answers 401/403 (callExternal classes that as `auth_failed`)
 * — forces a token refresh and retries the call exactly once.
 *
 * Propagates the token errors from getAccessToken:
 *   • ConnectionNotFoundError — the (client, provider) is not connected.
 *   • TokenRevokedError       — the connection was revoked.
 *   • TokenRefreshFailedError — a refresh failed; getAccessToken has already
 *                               marked the connection `refresh_failed` and
 *                               fired the operator alert.
 *
 * The returned IntegrationResult is whatever `fetchFn` produced (the retry's
 * result when a retry happened) — a non-auth failure is handed back as-is.
 */
export async function callWithToken<T>(
  clientId: string,
  provider: OAuthProviderId,
  fetchFn: (accessToken: string) => Promise<IntegrationResult<T>>,
): Promise<IntegrationResult<T>> {
  const token = await getAccessToken(clientId, provider);
  let result = await fetchFn(token);

  // A 401/403 means the token is bad even if it was not clock-expired —
  // force a refresh and retry once. getAccessToken({ forceRefresh }) throws
  // TokenRefreshFailedError on a failed refresh (after marking the connection
  // refresh_failed and alerting the operator) — let that propagate.
  if (!result.ok && result.error.class === 'auth_failed') {
    const refreshed = await refreshOrThrow(clientId, provider);
    result = await fetchFn(refreshed);
  }

  if (result.ok) {
    void touchConnectionUsed(clientId, provider);
  }
  return result;
}

/** Force a token refresh; normalise any non-token error into
 *  TokenRefreshFailedError so callers handle one failure type. */
async function refreshOrThrow(
  clientId: string,
  provider: OAuthProviderId,
): Promise<string> {
  try {
    return await getAccessToken(clientId, provider, { forceRefresh: true });
  } catch (error) {
    if (error instanceof TokenRefreshFailedError) throw error;
    throw new TokenRefreshFailedError(
      `Could not refresh the ${provider} token for client ${clientId}: ` +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}
