// =============================================================================
// Generic OAuth helpers — authorization URL, code exchange, signed state.
//
// Phase 7 Session 2. Provider-agnostic glue over the provider registry
// (oauth-providers.ts). The connect route builds an authorization URL here;
// the callback route verifies state and exchanges the code here.
//
// SIGNED STATE. The OAuth `state` parameter is a tamper-proof, short-lived
// token minted in the connect route (where the operator is authenticated) and
// verified in the callback. It carries the tenant + the initiating operator +
// a nonce, HMAC-SHA256 signed. This is the OAuth CSRF defence AND the only
// thing carrying authenticated context into the callback (a provider redirect
// arrives with no Authorization header / no app session).
//
// SERVER-ONLY.
// =============================================================================

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { env, getAppBaseUrl } from '@/lib/env';
import type { OAuthProviderId } from '@/lib/integrations/connections';

import { getOAuthProvider } from './oauth-providers';
import type { ExchangeResult } from './oauth-providers';

// --- redirect URI ------------------------------------------------------------

/**
 * The exact redirect URI for a provider's OAuth callback. This MUST match the
 * URI registered with the provider (Google/Meta verify it byte-for-byte), so
 * the connect route and the callback route both resolve it through here.
 *
 * Resolution: the provider-specific *_OAUTH_REDIRECT_URI_BASE env var when
 * set, else the app's own base URL + /api/integrations. The provider id and
 * /callback are appended in code.
 */
export function buildRedirectUri(provider: OAuthProviderId): string {
  const explicitBase =
    provider === 'google_business_profile'
      ? env.GOOGLE_OAUTH_REDIRECT_URI_BASE
      : env.META_OAUTH_REDIRECT_URI_BASE;
  const base = explicitBase ?? `${requireAppBaseUrl()}/api/integrations`;
  return `${base.replace(/\/+$/, '')}/${provider}/callback`;
}

function requireAppBaseUrl(): string {
  const base = getAppBaseUrl();
  if (!base) {
    throw new Error(
      'Cannot build an OAuth redirect URI — set APP_BASE_URL (or the ' +
        'provider-specific *_OAUTH_REDIRECT_URI_BASE) so Webnua knows its own origin.',
    );
  }
  return base;
}

// --- signed state ------------------------------------------------------------

/** The decoded payload of an OAuth `state` token. */
export type OAuthStatePayload = {
  provider: OAuthProviderId;
  /** The Webnua tenant (client) the connection is being made for. */
  clientId: string;
  /** The operator who initiated the connect flow. */
  operatorId: string;
  /** Random per-flow value — defeats state replay. */
  nonce: string;
  /** Issued-at, epoch seconds. */
  iat: number;
};

// A consent flow should complete well within 15 minutes.
const STATE_TTL_SECONDS = 15 * 60;

/** The HMAC key for state signing. A dedicated OAUTH_STATE_SECRET when set,
 *  otherwise the service-role key — always present server-side and high
 *  entropy. Throws if neither is available (a server with no secrets at all). */
function stateKey(): string {
  const key = env.OAUTH_STATE_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'OAuth state signing has no key — set OAUTH_STATE_SECRET (or ' +
        'SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  return key;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return createHmac('sha256', stateKey()).update(data).digest('base64url');
}

/** Mint a signed state token for a connect flow. */
export function signOAuthState(
  input: Omit<OAuthStatePayload, 'nonce' | 'iat'>,
): string {
  const payload: OAuthStatePayload = {
    ...input,
    nonce: randomBytes(16).toString('hex'),
    iat: Math.floor(Date.now() / 1000),
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Verify + decode a state token. Throws on a bad signature, a malformed
 *  token, or expiry — the callroute treats any throw as a rejected callback. */
export function verifyOAuthState(token: string): OAuthStatePayload {
  const dot = token.indexOf('.');
  if (dot <= 0) throw new Error('Malformed OAuth state token.');
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('OAuth state signature does not verify.');
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthStatePayload;
  } catch {
    throw new Error('OAuth state payload is not valid JSON.');
  }
  if (typeof payload.iat !== 'number' || typeof payload.clientId !== 'string') {
    throw new Error('OAuth state payload is missing required fields.');
  }
  if (Math.floor(Date.now() / 1000) - payload.iat > STATE_TTL_SECONDS) {
    throw new Error('OAuth state token has expired — restart the connection.');
  }
  return payload;
}

// --- authorization URL -------------------------------------------------------

/**
 * Build the provider's authorization (consent) URL the operator's browser is
 * sent to. `scopes` defaults to the provider's default set.
 */
export function generateAuthorizationUrl(
  provider: OAuthProviderId,
  options: { redirectUri: string; state: string; scopes?: readonly string[] },
): string {
  const def = getOAuthProvider(provider);
  const oauthClientId =
    provider === 'google_business_profile'
      ? env.GOOGLE_OAUTH_CLIENT_ID
      : env.META_APP_ID;
  if (!oauthClientId) {
    throw new Error(`OAuth app credentials are not configured for ${provider}.`);
  }
  const scopes = options.scopes ?? def.defaultScopes;
  const url = new URL(def.authorizationUrl);
  url.searchParams.set('client_id', oauthClientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', options.state);
  for (const [key, value] of Object.entries(def.authorizationParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

// --- code exchange -----------------------------------------------------------

/**
 * Exchange an authorization code for tokens. Delegates the provider-specific
 * exchange (Google's single POST, Meta's two-step short->long-lived swap) to
 * the provider registry; the result shape is uniform.
 */
export function exchangeCodeForTokens(
  provider: OAuthProviderId,
  input: { code: string; redirectUri: string; tenantId: string },
): Promise<ExchangeResult> {
  return getOAuthProvider(provider).exchangeCode(input);
}
