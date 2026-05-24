// =============================================================================
// Disposable-email-domain check — Pattern B signup gate.
//
// The signup route refuses emails whose domain appears in the curated
// `disposable-email-domains` npm list (~121k domains as of v1.0.62). The
// list is server-only and ~6 MB on disk; tree-shakes out of the client
// bundle because it's imported only by SERVER routes.
//
// What this catches:
//   • mailinator, tempmail, guerrillamail, 10minutemail, and the long
//     tail of trash-inbox services tradies sometimes use to "kick the
//     tires" on a paid product.
//
// What this does NOT catch:
//   • A real Gmail / Outlook / iCloud throwaway. The blocklist only knows
//     domains; gmail.com is real-business-address territory and stays
//     allowed.
//   • New disposable domains the list hasn't ingested. The list is
//     curated, not exhaustive.
//
// The check is intentionally LATE in /api/sign-up (after format validation,
// before the auth.users insert) so the user sees the friendliest possible
// error: "Please use your real business email address." Not "rate
// limited" or "Stripe failed".
// =============================================================================

import disposableDomains from 'disposable-email-domains';

// Cast and freeze once at module load. The npm export is `string[]`; we
// store as a Set for O(1) lookup. The Set is shared across requests.
const DISPOSABLE_DOMAINS_SET: ReadonlySet<string> = new Set(
  (disposableDomains as readonly string[]).map((d) => d.trim().toLowerCase()),
);

/** Extract and normalise the domain part of an email — lower-cased, no
 *  surrounding whitespace. Returns null for a malformed email (no `@` or
 *  no domain part). */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at >= email.length - 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/**
 * True if the email's domain is on the disposable blocklist.
 *
 * Strict domain match — does NOT walk subdomains. So `mail.mailinator.com`
 * passes (false) while `mailinator.com` blocks (true). This is intentional:
 * subdomain disposables are rare and false-positive risk is high.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  return DISPOSABLE_DOMAINS_SET.has(domain);
}
