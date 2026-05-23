// =============================================================================
// Email threading — plus-addressed lookup tokens, DB-backed.
//
// Phase 7 Resend session. When we send an outbound email to a lead we set
// the Reply-To header to `{clientSlug}+lead-{token}@{sendingDomain}`. The
// token is a SHORT random opaque string we also store on the corresponding
// `email_messages.thread_token` column; when the visitor replies, Resend's
// inbound webhook parses the recipient back to (clientSlug, token), then
// looks up the email_messages row by `thread_token` to recover the
// related_lead_id + verify the row's client_id matches the slug.
//
// Why random + DB-lookup (not self-contained HMAC):
//   1. RFC 5321 caps the local-part at 64 characters. A self-contained
//      HMAC-signed JSON payload runs ~140 chars before the slug prefix —
//      email validators (including Resend's) correctly reject it.
//   2. We already insert one `email_messages` row per outbound send and
//      store the token on it, so the lookup is essentially free — and
//      indexed (email_messages_thread_idx).
//   3. A 72-bit random token is infeasible to guess; the cross-tenant
//      guard at lookup time blocks any cross-tenant token reuse.
//
// Token format (single string):
//   `lead-{12-char-base64url}` — 17 chars total.
// Reply-To address:
//   `{clientSlug}+lead-{12-char}@{domain}` — fits easily in 64 chars even
//   for a max-length 30-char slug.
//
// SERVER-ONLY — uses node:crypto.randomBytes.
// =============================================================================

import { randomBytes } from 'node:crypto';

import { env } from '@/lib/env';

const TOKEN_PREFIX = 'lead-';
const TOKEN_RANDOM_BYTES = 9; // → 12 chars base64url, 72 bits of entropy.
const TOKEN_BODY_RE = /^[A-Za-z0-9_-]{8,40}$/;

// --- base64url helper --------------------------------------------------------

function base64UrlEncode(bytes: Buffer): string {
  return bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- token mint + shape check ------------------------------------------------

/**
 * Mint a fresh thread token. The token is opaque — its only meaning is
 * "the email_messages row that carries this thread_token belongs to lead X".
 * The caller MUST persist the token on the email_messages row at insert
 * time (the row's `thread_token` column carries the index the inbound
 * webhook looks up).
 *
 * Length budget: `lead-` (5) + base64url(9 bytes) (12) = 17 chars. Combined
 * with the longest possible client slug (30 chars), the resulting local-part
 * `{slug}+lead-{token}` totals at most 48 chars — well under RFC 5321's 64.
 */
export function generateThreadToken(): string {
  return `${TOKEN_PREFIX}${base64UrlEncode(randomBytes(TOKEN_RANDOM_BYTES))}`;
}

/** Quick syntactic guard before hitting the DB on inbound. A malformed
 *  token (wrong prefix, illegal characters, wrong length) is rejected
 *  without a query. */
export function isValidThreadTokenShape(token: string): boolean {
  if (typeof token !== 'string') return false;
  if (!token.startsWith(TOKEN_PREFIX)) return false;
  const body = token.slice(TOKEN_PREFIX.length);
  return TOKEN_BODY_RE.test(body);
}

// --- address composition + parsing -------------------------------------------

/** Compose the Reply-To address we set on an outbound email to a lead. */
export function composeReplyToAddress(clientSlug: string, threadToken: string): string {
  const domain = env.EMAIL_SENDING_DOMAIN;
  return `${clientSlug}+${threadToken}@${domain}`;
}

/** Parse an inbound recipient address (the `to` of the inbound webhook
 *  delivery) back to (clientSlug, threadToken). Returns null when the
 *  address is not in the plus-addressed shape. The caller then verifies
 *  the token with `isValidThreadTokenShape` and resolves the lead via
 *  the DB lookup on `email_messages.thread_token`. */
export function parseInboundAddress(
  address: string,
): { clientSlug: string; threadToken: string } | null {
  if (typeof address !== 'string') return null;
  // RFC 5321: the domain is case-insensitive, the local-part is NOT.
  // We MUST preserve case on the local-part because the thread token is a
  // base64url-encoded random (case-sensitive) — lowercasing it would break
  // the DB lookup. The client slug itself is always lowercase by convention
  // (constrained to [a-z0-9-]) so lowering it for comparison is safe.
  const trimmed = address.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  const sendingDomain = env.EMAIL_SENDING_DOMAIN.toLowerCase();
  if (domain !== sendingDomain && !domain.endsWith(`.${sendingDomain}`)) {
    return null;
  }
  const plus = local.indexOf('+');
  if (plus <= 0 || plus === local.length - 1) return null;
  const clientSlug = local.slice(0, plus).toLowerCase();
  const threadToken = local.slice(plus + 1);
  if (!/^[a-z0-9-]+$/.test(clientSlug)) return null;
  return { clientSlug, threadToken };
}

// --- auto-responder detection ------------------------------------------------

const AUTO_RESPONDER_HEADER_KEYS = [
  'auto-submitted',
  'x-autoreply',
  'x-autorespond',
  'x-auto-response-suppress',
  'precedence',
];

const AUTO_RESPONDER_SUBJECT_RE =
  /(out of office|out-of-office|auto[- ]?reply|auto[- ]?response|automatic reply|on vacation|on holiday|on leave)/i;

/** Heuristic: does this inbound look like an out-of-office / vacation reply?
 *  Detected by RFC 3834 `Auto-Submitted: auto-replied` (the canonical signal),
 *  the older `X-Autoreply` / `X-Autorespond` headers, `Precedence: bulk`,
 *  or the common subject patterns. Inbound rows flagged here are recorded
 *  for audit but excluded from the conversation view by default. */
export function looksLikeAutoResponder(email: {
  subject?: string;
  headers?: Record<string, string>;
}): boolean {
  const headers = email.headers ?? {};
  for (const key of AUTO_RESPONDER_HEADER_KEYS) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    if (!value) continue;
    const v = value.toLowerCase();
    if (key === 'auto-submitted' && v !== 'no' && v !== '') return true;
    if (key === 'precedence' && (v === 'bulk' || v === 'auto_reply' || v === 'list')) return true;
    if (key !== 'auto-submitted' && key !== 'precedence') return true;
  }
  if (email.subject && AUTO_RESPONDER_SUBJECT_RE.test(email.subject)) return true;
  return false;
}
