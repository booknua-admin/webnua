// =============================================================================
// Domain validation — pure, no I/O.
//
// Phase 9 custom-domain attachment. Validates a customer-supplied domain
// before it gets sent to Vercel.
//
// Conservative rules:
//   • Must be a syntactic FQDN (≥ 2 labels, ASCII letters/digits/hyphen, TLD
//     ≥ 2 chars).
//   • Protocol prefix (https:// etc.), path, query, port, surrounding dots
//     are stripped.
//   • Lowercased.
//   • Forbidden: webnua.com / webnua.dev / *.webnua.com / *.webnua.dev
//     (the platform's own hosts can't be attached as a customer's domain).
//   • Forbidden: a bare public-suffix TLD (`com`, `ie`, `co.uk`) — must be
//     a domain under one, not the TLD itself.
//
// Wildcard / multi-level subdomains: V1 supports apex + a single-level
// subdomain (voltline.ie, www.voltline.ie). Deeper subdomains like
// `book.shop.voltline.ie` are accepted by the regex; tightening if needed.
// =============================================================================

/** Hosts the platform owns. A customer can't attach these. The startsWith /
 *  endsWith pairing catches `foo.webnua.com` etc. */
const RESERVED_PARENTS = ['webnua.com', 'webnua.dev', 'webnua.app', 'localhost'];

/** Very rough public-suffix-ish list — covers the common single-label TLDs
 *  and a couple of common ccTLD second levels. Not a full PSL parse — those
 *  weigh more than this validation is worth. Add entries if a real customer
 *  collides. */
const PUBLIC_SUFFIXES = new Set([
  'com',
  'net',
  'org',
  'io',
  'ie',
  'uk',
  'co.uk',
  'org.uk',
  'com.au',
  'co.nz',
  'com.fr',
  'fr',
  'de',
  'es',
  'eu',
  'us',
  'ca',
  'app',
  'dev',
  'tech',
]);

export type DomainValidation = {
  valid: boolean;
  normalized: string;
  errors: string[];
};

/** Strip protocol / path / port / surrounding dots / whitespace; lowercase. */
function normalize(input: string): string {
  let d = input.trim().toLowerCase();
  if (!d) return '';
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/[/?#].*$/, '');
  d = d.replace(/:\d+$/, '');
  d = d.replace(/^\.+/, '').replace(/\.+$/, '');
  return d;
}

/** True for a syntactic FQDN. Rejects underscores, multi-byte chars, empty
 *  labels, all-numeric TLDs. */
function isFqdn(d: string): boolean {
  if (d.length > 253) return false;
  if (!/^[a-z0-9.-]+$/.test(d)) return false;
  if (d.startsWith('-') || d.endsWith('-') || d.includes('..')) return false;
  const labels = d.split('.');
  if (labels.length < 2) return false;
  if (labels.some((l) => l.length === 0 || l.length > 63)) return false;
  if (labels.some((l) => l.startsWith('-') || l.endsWith('-'))) return false;
  // TLD must be ≥ 2 chars, all letters.
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld)) return false;
  return true;
}

/** True when the input *is* a public-suffix-looking string (not a domain
 *  under one). `co.uk` → true; `voltline.co.uk` → false. */
function isBarePublicSuffix(d: string): boolean {
  if (PUBLIC_SUFFIXES.has(d)) return true;
  return false;
}

/** True when the input ends in one of the reserved parents OR equals one. */
function isReserved(d: string): boolean {
  return RESERVED_PARENTS.some((p) => d === p || d.endsWith(`.${p}`));
}

/** Validate a customer-supplied domain. Returns the normalized form + a
 *  flat list of human-readable errors. */
export function validateDomain(input: string): DomainValidation {
  const errors: string[] = [];
  const normalized = normalize(input);

  if (!normalized) {
    errors.push('Enter a domain (e.g. voltline.ie).');
    return { valid: false, normalized: '', errors };
  }
  if (!isFqdn(normalized)) {
    errors.push('That does not look like a valid domain.');
    return { valid: false, normalized, errors };
  }
  if (isBarePublicSuffix(normalized)) {
    errors.push('Enter a full domain like example.com, not just the top-level extension.');
    return { valid: false, normalized, errors };
  }
  if (isReserved(normalized)) {
    errors.push('Webnua-owned domains cannot be attached as custom domains.');
    return { valid: false, normalized, errors };
  }

  return { valid: true, normalized, errors: [] };
}

/** True if `domain` is an apex (root) domain like `example.com` — i.e. two
 *  labels with a single-label TLD, OR three labels ending in a ccTLD second
 *  level like `co.uk`. Conservative — when in doubt returns false. */
export function isApexDomain(domain: string): boolean {
  const labels = domain.split('.');
  if (labels.length === 2) return true;
  if (labels.length === 3) {
    const tail = `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
    if (PUBLIC_SUFFIXES.has(tail)) return true;
  }
  return false;
}
