// =============================================================================
// Vercel Domains API — typed response shapes.
//
// Phase 9 custom-domain attachment. These types describe the slice of the
// Vercel API the domain manager reads — they are defensive (most fields are
// optional) because Vercel's payloads vary between API versions and
// permission contexts.
//
// Distinct from the legacy `VercelDomainResult` in lib/website/vercel.ts
// (which carries only `verified` + an opaque `verification` array). The Phase
// 9 manager needs the full status / config / verification surface — so a new
// typed layer lives here.
// =============================================================================

/** Vercel-returned DNS record an operator must set at their registrar. */
export type VercelVerificationRecord = {
  type: string;
  domain: string;
  value: string;
  /** Vercel sometimes returns a reason describing what the record proves. */
  reason?: string;
};

/** Slice of POST /v10/projects/{id}/domains response. */
export type VercelProjectDomain = {
  name: string;
  verified: boolean;
  verification?: VercelVerificationRecord[];
  /** Set when the domain is misconfigured on Vercel's side. */
  error?: { code?: string; message?: string };
  createdAt?: number;
};

/** Slice of GET /v6/domains/{name}/config response — the DNS-side check. */
export type VercelDomainConfig = {
  /** True when the misconfigured-A / wrong-CNAME flag is set; false when
   *  DNS is pointing the right way. */
  misconfigured: boolean;
  configuredBy?: 'CNAME' | 'A' | 'http' | 'dns-01' | null;
};

/** Phase 9 error code surfaced to the UI. Maps a Vercel error onto something
 *  the operator can act on. */
export type VercelDomainErrorCode =
  | 'domain_already_in_use'
  | 'invalid_domain'
  | 'forbidden'
  | 'not_configured'
  | 'rate_limited'
  | 'unknown';

export type VercelDomainCallError = {
  code: VercelDomainErrorCode;
  message: string;
  status?: number;
};

/** Typed outcome of every domains-side Vercel call. The caller switches on
 *  `ok` and reads `data` (or `error`). */
export type VercelCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: VercelDomainCallError };

/** "Vercel is not configured for this deployment" — the env is unset. */
export type NotConfigured = { configured: false };
