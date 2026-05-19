// =============================================================================
// Custom-domain helpers — used by the connect-domain flow.
//
// The platform serves a published site on ANY hostname (src/middleware.ts
// rewrites every non-app host to the public renderer; lib/public-site/resolve
// matches the host against websites.domain_primary / domain_aliases). So
// "connecting" a custom domain is two things: storing it on the website row,
// and registering it with the host (Vercel) so HTTPS is issued. This module
// owns the parsing / validation / DNS-instruction side.
// =============================================================================

/** Vercel's standard DNS targets. Stable for years; the Vercel API also
 *  returns per-domain verification (TXT) records, surfaced separately. */
export const VERCEL_A_RECORD = '76.76.21.21';
export const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com';

export type DomainKind = 'apex' | 'subdomain';

export type DnsRecord = {
  type: 'A' | 'CNAME';
  /** The record name to set at the registrar — `@` for the root. */
  name: string;
  value: string;
  /** Which kind of domain this record is for. */
  forKind: DomainKind;
};

/**
 * Normalise a user-typed domain: drop any protocol / path / port / spaces /
 * surrounding dots, lowercase it. Returns null when the result is not a
 * plausible hostname (so the caller can reject it).
 */
export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/[/?#].*$/, ''); // path / query / hash
  d = d.replace(/:\d+$/, ''); // port
  d = d.replace(/^\.+/, '').replace(/\.+$/, ''); // surrounding dots
  // At least two labels, ASCII letters/digits/hyphens, TLD of 2+ letters.
  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return null;
  return d;
}

/**
 * apex (root domain — `example.com`) vs subdomain (`www.example.com`).
 * A leading `www.` or 3+ labels reads as a subdomain. Two-deep ccTLDs
 * (`example.co.uk`) are an accepted imperfection — the connect dialog shows
 * both record types and labels which is which, so the operator is never
 * blocked by a wrong guess.
 */
export function domainKind(domain: string): DomainKind {
  return domain.split('.').length <= 2 ? 'apex' : 'subdomain';
}

/** The two DNS records a registrar can use — an A record for a root domain,
 *  a CNAME for a `www` / subdomain. Both are returned so the dialog can show
 *  the pair and let the user pick the one that matches their domain. */
export function dnsRecordsFor(domain: string): DnsRecord[] {
  const labels = domain.split('.');
  const subName = labels.length > 2 ? labels.slice(0, -2).join('.') : 'www';
  return [
    { type: 'A', name: '@', value: VERCEL_A_RECORD, forKind: 'apex' },
    {
      type: 'CNAME',
      name: subName,
      value: VERCEL_CNAME_TARGET,
      forKind: 'subdomain',
    },
  ];
}
