// =============================================================================
// GET /api/integrations/[provider]/callback — the OAuth callback.
//
// Phase 7 Session 2. The provider redirects the operator's browser here after
// consent. This route has NO Authorization header to check — the provider
// redirect carries none. Its security IS the signed `state` token: minted in
// the connect route (where the operator was authenticated) and verified here.
// A forged or stale state is rejected.
//
// On success: exchange the code for tokens, discover the provider account id,
// store the connection (token encrypted into Vault), and redirect the operator
// back to Settings → Integrations with a status. On any failure: log it to
// integration_call_log and redirect with status=error so the operator sees a
// clear outcome rather than a raw error page.
// =============================================================================

import { NextResponse } from 'next/server';

import { isOAuthProviderId, type OAuthProviderId } from '@/lib/integrations/connections';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { buildRedirectUri, exchangeCodeForTokens, verifyOAuthState } from '@/lib/integrations/_shared/oauth';
import { getOAuthProvider } from '@/lib/integrations/_shared/oauth-providers';
import { storeConnection } from '@/lib/integrations/_shared/tokens';

// Token exchange + account lookup are a couple of network round-trips.
export const maxDuration = 60;

type CallbackStatus = 'connected' | 'denied' | 'error';

/** Reject external-host / protocol-relative redirects — only `/internal-paths`
 *  are accepted. (Same rule the connect route applies; this is defence in
 *  depth: the state token IS signed, but we still refuse anything that does
 *  not look like a same-origin path on read.) */
function isSafeInternalPath(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.startsWith('/') &&
    !value.startsWith('//')
  );
}

/** Redirect the caller back to the post-OAuth landing surface with an
 *  outcome. Defaults to `/settings/integrations`; an onboarding-initiated
 *  connect supplies `/dashboard` via the state token's `returnTo` field.
 *  The caller's workspace context (active sub-account) is browser-local, so
 *  it is still set on return — no need to thread the client id through. */
function redirectToLanding(
  request: Request,
  provider: string,
  status: CallbackStatus,
  reason?: string,
  returnTo?: string,
): Response {
  const path = isSafeInternalPath(returnTo) ? returnTo : '/settings/integrations';
  const url = new URL(path, new URL(request.url).origin);
  url.searchParams.set('integration', provider);
  url.searchParams.set('integration_status', status);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

/** Best-effort audit row for a callback that failed before/within the
 *  exchange. callExternal already logs the provider HTTP calls themselves;
 *  this captures our own validation failures (bad state, etc.). */
async function logCallbackFailure(
  provider: string,
  clientId: string | null,
  message: string,
): Promise<void> {
  try {
    await getIntegrationDb()
      .from('integration_call_log')
      .insert({
        provider,
        operation: 'oauth_callback',
        direction: 'inbound',
        request_shape: null,
        response_status: null,
        response_shape: null,
        latency_ms: null,
        error_class: 'non_retryable',
        error_message: message.slice(0, 500),
        client_id: clientId,
        correlation_id: null,
      });
  } catch (error) {
    console.warn('[oauth/callback] failure log write failed', error);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider: rawProvider } = await params;
  if (!isOAuthProviderId(rawProvider)) {
    await logCallbackFailure(rawProvider, null, 'unknown provider in callback URL');
    return redirectToLanding(request, rawProvider, 'error', 'unknown-provider');
  }
  const provider: OAuthProviderId = rawProvider;

  const query = new URL(request.url).searchParams;

  // The provider signals a declined consent with an `error` param
  // (Google: access_denied). Not a failure — the operator chose not to grant.
  const providerError = query.get('error');
  if (providerError) {
    return redirectToLanding(request, provider, 'denied', providerError);
  }

  const code = query.get('code');
  const state = query.get('state');
  if (!code || !state) {
    await logCallbackFailure(provider, null, 'callback missing code or state');
    return redirectToLanding(request, provider, 'error', 'missing-params');
  }

  // Verify the signed state — this is the route's only authentication.
  let clientId: string;
  let returnTo: string | undefined;
  try {
    const payload = verifyOAuthState(state);
    if (payload.provider !== provider) {
      throw new Error('state provider does not match the callback provider');
    }
    clientId = payload.clientId;
    returnTo = payload.returnTo;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logCallbackFailure(provider, null, `state verification failed: ${message}`);
    return redirectToLanding(request, provider, 'error', 'bad-state');
  }

  try {
    const redirectUri = buildRedirectUri(provider);
    const tokens = await exchangeCodeForTokens(provider, {
      code,
      redirectUri,
      tenantId: clientId,
    });

    // Discover the customer's account id on the provider.
    const providerAccountId = await getOAuthProvider(provider).fetchAccountId({
      accessToken: tokens.accessToken,
      tenantId: clientId,
    });

    // Map the exchange result onto the storage shape per token model.
    const tokenModel = getOAuthProvider(provider).tokenModel;
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    if (tokenModel === 'refresh_access') {
      if (!tokens.refreshToken) {
        throw new Error('no refresh token returned for a refresh_access provider');
      }
      await storeConnection({
        clientId,
        provider,
        providerAccountId,
        persistentToken: tokens.refreshToken,
        accessTokenCached: tokens.accessToken,
        accessTokenExpiresAt: expiresAt,
        tokenModel,
        scopes: tokens.scopes,
      });
    } else {
      // long_lived: the access token IS the persistent secret.
      await storeConnection({
        clientId,
        provider,
        providerAccountId,
        persistentToken: tokens.accessToken,
        accessTokenCached: null,
        accessTokenExpiresAt: expiresAt,
        tokenModel,
        scopes: tokens.scopes,
      });
    }

    return redirectToLanding(request, provider, 'connected', undefined, returnTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[oauth/callback] connection failed', error);
    await logCallbackFailure(provider, clientId, message);
    return redirectToLanding(request, provider, 'error', 'exchange-failed', returnTo);
  }
}
