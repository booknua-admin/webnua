// =============================================================================
// Per-tenant OAuth connections — client-safe types + provider display data.
//
// Phase 7 Session 2. This module is the CLIENT-SAFE half of the OAuth layer:
// pure types and display metadata, no server imports. It is imported by the
// operator connections UI ('use client') AND by the server-only behavioural
// registry (oauth-providers.ts) and the DB row types (db-types.ts).
//
// The server-only behaviour — code/token exchange, refresh, revoke, account
// lookup — lives in src/lib/integrations/_shared/oauth-providers.ts, which
// must NOT be imported by client code (it pulls in callExternal + env).
// =============================================================================

/** The OAuth providers Webnua connects on a per-tenant (per-customer) basis.
 *  Google Ads is intentionally absent — operator decision: not building it. */
export type OAuthProviderId = 'google_business_profile' | 'meta_ads';

export const OAUTH_PROVIDER_IDS: readonly OAuthProviderId[] = [
  'google_business_profile',
  'meta_ads',
];

/** Type guard — narrows an arbitrary route slug to a known provider. */
export function isOAuthProviderId(value: string): value is OAuthProviderId {
  return (OAUTH_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * How a provider's tokens behave — the two patterns the foundation supports:
 *   • refresh_access — short-lived access token + long-lived refresh token
 *     (Google / GBP). The refresh token is persistent; access tokens are
 *     re-minted on demand.
 *   • long_lived — one long-lived access token, no refresh token (Meta). The
 *     token is refreshed in place ("extended") before it expires.
 */
export type TokenModel = 'refresh_access' | 'long_lived';

/** Lifecycle of a stored connection. */
export type IntegrationConnectionStatus =
  | 'active'
  | 'refresh_failed'
  | 'revoked'
  | 'expired';

/** Display metadata for one provider — used by the operator connections UI. */
export type OAuthProviderDisplay = {
  id: OAuthProviderId;
  /** Operator-facing name. */
  name: string;
  /** One line on what connecting this unlocks. */
  blurb: string;
  /** `IntegrationCard` logo tone — the brand-tinted glyph tile. */
  logoTone: 'gbp' | 'meta';
  /** Single-letter glyph for the logo tile. */
  logoInitial: string;
  tokenModel: TokenModel;
};

export const OAUTH_PROVIDER_DISPLAY: Record<OAuthProviderId, OAuthProviderDisplay> = {
  google_business_profile: {
    id: 'google_business_profile',
    name: 'Google Business Profile',
    blurb: 'Pull reviews and keep the business listing in sync for review automation and local SEO.',
    logoTone: 'gbp',
    logoInitial: 'G',
    tokenModel: 'refresh_access',
  },
  meta_ads: {
    id: 'meta_ads',
    name: 'Meta Ads',
    blurb: 'Manage Facebook and Instagram ad campaigns and read their performance.',
    logoTone: 'meta',
    logoInitial: 'M',
    tokenModel: 'long_lived',
  },
};
