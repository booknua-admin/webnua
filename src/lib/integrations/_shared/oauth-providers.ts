// =============================================================================
// OAuth provider registry — per-provider OAuth quirks, behind one interface.
//
// Phase 7 Session 2. Generic OAuth helpers (oauth.ts) and token management
// (tokens.ts) stay provider-agnostic; every provider-specific detail —
// endpoints, the code-for-token exchange shape, how a token is refreshed, how
// it is revoked, how the account id is discovered — is declared here.
//
// Two registered providers: google_business_profile (Google's refresh_access
// model) and meta_ads (Meta's long_lived model). Google Ads is intentionally
// not registered (operator decision: not building it).
//
// META — the OAuth flow + business-logic data layer landed in the Phase 7
// Meta Ads session. The Graph version is env-driven (META_API_VERSION;
// defaults to v21.0) and the scope set covers ads_management +
// business_management + pages_show_list + pages_manage_ads +
// leads_retrieval. The token exchange + refresh + revoke + fetchAccountId
// have not yet been smoke-tested against a real Meta app in production
// (live verification requires the operator to complete Meta business
// verification + App Review for each sensitive scope — see CLAUDE.md
// "Google Business Profile — operator setup" parallel for the
// Meta-equivalent steps).
//
// SERVER-ONLY — every call routes through callExternal(), which holds the
// service-role client for logging.
// =============================================================================

import { env } from '@/lib/env';
import type { OAuthProviderId, TokenModel } from '@/lib/integrations/connections';

import { callExternal } from './call';

// --- result shapes -----------------------------------------------------------

/** Tokens returned by a successful authorization-code exchange. */
export type ExchangeResult = {
  /** The access token (short-lived for Google, the long-lived token for Meta). */
  accessToken: string;
  /** The refresh token — present for refresh_access providers, null otherwise. */
  refreshToken: string | null;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
  /** Granted scopes (best-effort — some providers omit them from the response). */
  scopes: string[];
};

/** The outcome of refreshing a connection's token. */
export type RefreshResult = {
  /** The fresh access token. */
  accessToken: string;
  /** Seconds until `accessToken` expires. */
  expiresIn: number;
  /**
   * The new value of the PERSISTENT secret, when refreshing rotated it:
   *   • refresh_access (Google) — null; the refresh token is unchanged, only
   *     a new access token was minted.
   *   • long_lived (Meta) — the new long-lived token; the persistent secret
   *     itself rotated and Vault must be updated.
   */
  newPersistentToken: string | null;
};

/** Inputs every provider function shares. `tenantId` is the Webnua client id —
 *  passed straight to callExternal so the call is attributed to the tenant in
 *  integration_call_log. It is NOT the OAuth app client id. */
type TenantContext = { tenantId: string };

export type OAuthProvider = {
  id: OAuthProviderId;
  tokenModel: TokenModel;
  /** The provider's authorization (consent) endpoint. */
  authorizationUrl: string;
  /** The provider's token endpoint (code exchange + refresh). */
  tokenExchangeUrl: string;
  /** The provider's token-revocation endpoint, or null when revocation is a
   *  different API shape (Meta — see `revoke`). */
  revocationUrl: string | null;
  /** Scopes requested when none are passed explicitly. */
  defaultScopes: readonly string[];
  /** Extra query params merged into the authorization URL (e.g. Google's
   *  offline-access flags that force a refresh token to be issued). */
  authorizationParams: Record<string, string>;
  /** True when the OAuth app credentials for this provider are configured. */
  isConfigured: () => boolean;

  /** Exchange an authorization code for tokens. */
  exchangeCode: (
    input: TenantContext & { code: string; redirectUri: string },
  ) => Promise<ExchangeResult>;
  /** Refresh a connection's token from its persistent secret. */
  refreshToken: (
    input: TenantContext & { persistentToken: string },
  ) => Promise<RefreshResult>;
  /** Revoke access at the provider. Best-effort — callers proceed with local
   *  cleanup even if this throws. */
  revoke: (
    input: TenantContext & { persistentToken: string; providerAccountId: string },
  ) => Promise<void>;
  /** Discover the customer's account id on the provider, post-exchange. */
  fetchAccountId: (input: TenantContext & { accessToken: string }) => Promise<string>;
};

// --- helpers -----------------------------------------------------------------

/** Build an x-www-form-urlencoded body — the shape every token endpoint here
 *  expects. */
function form(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };

/** A token-endpoint JSON response (Google + Meta share enough of the shape). */
type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

// =============================================================================
// Google Business Profile — token model: refresh_access.
// =============================================================================

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
// Google My Business Account Management API — lists the accounts the granted
// token can manage.
const GOOGLE_ACCOUNTS_URL =
  'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';

const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/business.manage'] as const;

function googleCreds(): { clientId: string; clientSecret: string } {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth is not configured — set GOOGLE_OAUTH_CLIENT_ID and ' +
        'GOOGLE_OAUTH_CLIENT_SECRET.',
    );
  }
  return { clientId, clientSecret };
}

const googleBusinessProfile: OAuthProvider = {
  id: 'google_business_profile',
  tokenModel: 'refresh_access',
  authorizationUrl: GOOGLE_AUTH_URL,
  tokenExchangeUrl: GOOGLE_TOKEN_URL,
  revocationUrl: GOOGLE_REVOKE_URL,
  defaultScopes: GOOGLE_SCOPES,
  // access_type=offline + prompt=consent => Google always issues a refresh
  // token (without prompt, a re-consent for an already-authorized app omits
  // it and the connection would have no way to refresh).
  authorizationParams: { access_type: 'offline', prompt: 'consent' },

  isConfigured: () =>
    Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET),

  async exchangeCode({ code, redirectUri, tenantId }) {
    const { clientId, clientSecret } = googleCreds();
    const result = await callExternal<TokenResponse>({
      provider: 'google_business_profile',
      operation: 'oauth_code_exchange',
      url: GOOGLE_TOKEN_URL,
      method: 'POST',
      headers: FORM_HEADERS,
      rawBody: form({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      clientId: tenantId,
    });
    if (!result.ok) throw new Error(`Google code exchange failed: ${result.error.message}`);
    const data = result.data;
    if (!data.access_token) throw new Error('Google code exchange returned no access token.');
    if (!data.refresh_token) {
      // Without a refresh token the connection cannot survive the access
      // token's 1h life — treat it as a failed connect.
      throw new Error(
        'Google returned no refresh token — re-consent is required ' +
          '(authorization must use access_type=offline & prompt=consent).',
      );
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 3600,
      scopes: data.scope ? data.scope.split(' ') : [...GOOGLE_SCOPES],
    };
  },

  async refreshToken({ persistentToken, tenantId }) {
    const { clientId, clientSecret } = googleCreds();
    const result = await callExternal<TokenResponse>({
      provider: 'google_business_profile',
      operation: 'oauth_token_refresh',
      url: GOOGLE_TOKEN_URL,
      method: 'POST',
      headers: FORM_HEADERS,
      rawBody: form({
        refresh_token: persistentToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
      clientId: tenantId,
    });
    if (!result.ok) throw new Error(`Google token refresh failed: ${result.error.message}`);
    if (!result.data.access_token) {
      throw new Error('Google token refresh returned no access token.');
    }
    return {
      accessToken: result.data.access_token,
      expiresIn: result.data.expires_in ?? 3600,
      // Google's refresh token is long-lived and unchanged by a refresh.
      newPersistentToken: null,
    };
  },

  async revoke({ persistentToken, tenantId }) {
    const result = await callExternal({
      provider: 'google_business_profile',
      operation: 'oauth_revoke',
      url: GOOGLE_REVOKE_URL,
      method: 'POST',
      headers: FORM_HEADERS,
      rawBody: form({ token: persistentToken }),
      clientId: tenantId,
    });
    // Revoking an already-invalid token returns 400; that is still "revoked".
    if (!result.ok && result.error.status !== 400) {
      throw new Error(`Google revoke failed: ${result.error.message}`);
    }
  },

  async fetchAccountId({ accessToken, tenantId }) {
    const result = await callExternal<{ accounts?: { name?: string }[] }>({
      provider: 'google_business_profile',
      operation: 'fetch_account_id',
      url: GOOGLE_ACCOUNTS_URL,
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      clientId: tenantId,
    });
    if (!result.ok) throw new Error(`Google account lookup failed: ${result.error.message}`);
    const first = result.data.accounts?.[0]?.name;
    if (!first) {
      throw new Error(
        'Google returned no Business Profile accounts for this user — the ' +
          'connected Google account manages no business listing.',
      );
    }
    // e.g. "accounts/123456789".
    return first;
  },
};

// =============================================================================
// Meta Ads — token model: long_lived.
//
// Phase 7 Meta Ads session — the OAuth scaffolding shipped in Session 2 is
// now connected to a real per-tenant token flow + the campaign/insights
// data layer (see lib/integrations/meta-ads/).
// =============================================================================

// Graph API version. Read from env (META_API_VERSION) so the operator can
// bump it without a code change; defaults to v21.0 (current at time of
// writing — Meta keeps each version live for ~2 years, see the platform
// changelog at developers.facebook.com/docs/graph-api/changelog).
const META_GRAPH_VERSION = env.META_API_VERSION ?? 'v21.0';
const META_AUTH_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;
const META_TOKEN_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`;
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// The Webnua scope set:
//   • ads_read / ads_management        — read + write campaigns, ad sets, ads, insights
//   • business_management              — read the user's Business Manager accounts
//   • pages_show_list / pages_manage_ads — list the FB Pages the user owns +
//                                          attach ads to them (lead-gen ads
//                                          require a Page)
//   • leads_retrieval                  — pull lead-form submissions
// All sensitive — each requires Meta App Review approval before the app can
// request them from real customers. Webnua's own "test users" added on the
// Developer dashboard can grant them without review.
const META_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
  'pages_show_list',
  'pages_manage_ads',
  'leads_retrieval',
] as const;

// A Meta long-lived token lasts ~60 days; the response sometimes omits
// expires_in, so this is the fallback.
const META_LONG_LIVED_TTL_SECONDS = 60 * 24 * 60 * 60;

function metaCreds(): { appId: string; appSecret: string } {
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('Meta OAuth is not configured — set META_APP_ID and META_APP_SECRET.');
  }
  return { appId, appSecret };
}

const metaAds: OAuthProvider = {
  id: 'meta_ads',
  tokenModel: 'long_lived',
  authorizationUrl: META_AUTH_URL,
  tokenExchangeUrl: META_TOKEN_URL,
  // Meta has no OAuth revocation endpoint — revoking is a DELETE on the
  // user's app permissions (see `revoke`).
  revocationUrl: null,
  defaultScopes: META_SCOPES,
  authorizationParams: {},

  isConfigured: () => Boolean(env.META_APP_ID && env.META_APP_SECRET),

  // Meta's flow is two steps: code -> short-lived token, then short-lived ->
  // long-lived token. The long-lived token is what Webnua persists.
  async exchangeCode({ code, redirectUri, tenantId }) {
    const { appId, appSecret } = metaCreds();
    // Step 1 — code for a short-lived token.
    const shortUrl = `${META_TOKEN_URL}?${form({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    })}`;
    const shortResult = await callExternal<TokenResponse>({
      provider: 'meta_ads',
      operation: 'oauth_code_exchange',
      url: shortUrl,
      method: 'GET',
      clientId: tenantId,
    });
    if (!shortResult.ok) {
      throw new Error(`Meta code exchange failed: ${shortResult.error.message}`);
    }
    const shortToken = shortResult.data.access_token;
    if (!shortToken) throw new Error('Meta code exchange returned no access token.');

    // Step 2 — short-lived token for a long-lived token.
    const longUrl = `${META_TOKEN_URL}?${form({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    })}`;
    const longResult = await callExternal<TokenResponse>({
      provider: 'meta_ads',
      operation: 'oauth_long_lived_exchange',
      url: longUrl,
      method: 'GET',
      clientId: tenantId,
    });
    if (!longResult.ok) {
      throw new Error(`Meta long-lived exchange failed: ${longResult.error.message}`);
    }
    const longToken = longResult.data.access_token;
    if (!longToken) throw new Error('Meta long-lived exchange returned no access token.');
    return {
      accessToken: longToken,
      // Meta has no refresh token — the long-lived token is the persistent
      // secret, refreshed in place by `refreshToken`.
      refreshToken: null,
      expiresIn: longResult.data.expires_in ?? META_LONG_LIVED_TTL_SECONDS,
      scopes: [...META_SCOPES],
    };
  },

  // Refreshing a Meta long-lived token = extending it via fb_exchange_token
  // with the CURRENT long-lived token. The result is a NEW long-lived token,
  // so newPersistentToken is set and Vault is rotated.
  async refreshToken({ persistentToken, tenantId }) {
    const { appId, appSecret } = metaCreds();
    const url = `${META_TOKEN_URL}?${form({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: persistentToken,
    })}`;
    const result = await callExternal<TokenResponse>({
      provider: 'meta_ads',
      operation: 'oauth_token_refresh',
      url,
      method: 'GET',
      clientId: tenantId,
    });
    if (!result.ok) throw new Error(`Meta token refresh failed: ${result.error.message}`);
    const token = result.data.access_token;
    if (!token) throw new Error('Meta token refresh returned no access token.');
    return {
      accessToken: token,
      expiresIn: result.data.expires_in ?? META_LONG_LIVED_TTL_SECONDS,
      newPersistentToken: token,
    };
  },

  // TODO(meta): verify against a live app. Meta revocation is DELETE on the
  // user's app permissions; `providerAccountId` is the Meta user id (set by
  // fetchAccountId below).
  async revoke({ persistentToken, providerAccountId, tenantId }) {
    const url = `${META_GRAPH_BASE}/${providerAccountId}/permissions?${form({
      access_token: persistentToken,
    })}`;
    const result = await callExternal({
      provider: 'meta_ads',
      operation: 'oauth_revoke',
      url,
      method: 'DELETE',
      clientId: tenantId,
    });
    if (!result.ok) throw new Error(`Meta revoke failed: ${result.error.message}`);
  },

  // TODO(meta): the Meta user id is used as provider_account_id — it is what
  // revocation needs and is stable. The ad-account id (act_*) is business
  // logic for the Meta session and is discovered there, not here.
  async fetchAccountId({ accessToken, tenantId }) {
    const url = `${META_GRAPH_BASE}/me?${form({ access_token: accessToken, fields: 'id' })}`;
    const result = await callExternal<{ id?: string }>({
      provider: 'meta_ads',
      operation: 'fetch_account_id',
      url,
      method: 'GET',
      clientId: tenantId,
    });
    if (!result.ok) throw new Error(`Meta account lookup failed: ${result.error.message}`);
    if (!result.data.id) throw new Error('Meta account lookup returned no user id.');
    return result.data.id;
  },
};

// --- registry ----------------------------------------------------------------

const REGISTRY: Record<OAuthProviderId, OAuthProvider> = {
  google_business_profile: googleBusinessProfile,
  meta_ads: metaAds,
};

/** The provider definition for an id. */
export function getOAuthProvider(id: OAuthProviderId): OAuthProvider {
  return REGISTRY[id];
}

/** True when the OAuth app credentials for a provider are configured. */
export function isOAuthProviderConfigured(id: OAuthProviderId): boolean {
  return REGISTRY[id].isConfigured();
}
