// =============================================================================
// Email threading — plus-addressing tokens with HMAC signatures.
//
// Phase 7 Resend session. When we send an outbound email to a lead we set
// the Reply-To header to `{clientSlug}+lead-{token}@{sendingDomain}`. The
// token is an HMAC-signed payload identifying the lead; when the visitor
// replies, Resend's inbound webhook delivers the message and we parse the
// recipient address back to (clientSlug, leadId).
//
// Why HMAC, not a database lookup id: a database id would be guessable +
// enumerable — a curious recipient could craft an address pointing at a
// different lead and have their reply land in someone else's inbox. The
// HMAC binds the leadId to a server secret, so a third party cannot forge
// a token for a leadId they did not see.
//
// Token format (base64url-encoded JSON, no padding):
//   { "v": 1, "lid": "<lead-uuid>", "iat": <unix-seconds> }
// Signature is base64url(hmac-sha256(secret, payload-bytes)) — 32 bytes
// raw, 43 chars encoded. Final token: `{payload}.{signature}`.
//
// SERVER-ONLY — reads OAUTH_STATE_SECRET / SUPABASE_SERVICE_ROLE_KEY. Never
// import from client code.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '@/lib/env';

const TOKEN_VERSION = 1;
const TOKEN_PREFIX = 'lead-';

// --- secret resolution -------------------------------------------------------

/** Resolve the HMAC key. OAUTH_STATE_SECRET if set (same convention as the
 *  OAuth state token); otherwise the service-role key (always present
 *  server-side, high entropy). Returns null on a misconfigured deployment. */
function hmacKey(): string | null {
  if (env.OAUTH_STATE_SECRET) return env.OAUTH_STATE_SECRET;
  if (env.SUPABASE_SERVICE_ROLE_KEY) return env.SUPABASE_SERVICE_ROLE_KEY;
  return null;
}

// --- base64url helpers -------------------------------------------------------

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): Buffer | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return Buffer.from(padded + pad, 'base64');
  } catch {
    return null;
  }
}

// --- token mint + verify -----------------------------------------------------

type TokenPayload = {
  v: number;
  lid: string;
  iat: number;
};

/**
 * Mint a thread token binding the given leadId to a server-side HMAC.
 *
 * The token shape — `lead-{base64url-payload}.{base64url-signature}` — fits
 * inside an email local-part (RFC 5321 limit 64 chars). Typical length is
 * ~110 chars, so the local-part is `{clientSlug}+{TOKEN_PREFIX}{token}` —
 * keep clientSlug short.
 *
 * @throws if no HMAC key is configured.
 */
export function generateThreadToken(leadId: string): string {
  const key = hmacKey();
  if (!key) {
    throw new Error(
      'generateThreadToken: no HMAC key (OAUTH_STATE_SECRET / SUPABASE_SERVICE_ROLE_KEY unset).',
    );
  }
  const payload: TokenPayload = {
    v: TOKEN_VERSION,
    lid: leadId,
    iat: Math.floor(Date.now() / 1000),
  };
  const payloadStr = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    createHmac('sha256', key).update(payloadStr, 'utf8').digest(),
  );
  return `${TOKEN_PREFIX}${payloadStr}.${signature}`;
}

/** Parse + verify a thread token. Returns the leadId on success, null when
 *  the token is malformed, signed with a different secret, or simply not a
 *  thread token (e.g. an inbound to a generic address like
 *  notifications@…). */
export function parseThreadToken(rawToken: string): { leadId: string } | null {
  if (typeof rawToken !== 'string' || rawToken.length === 0) return null;
  if (!rawToken.startsWith(TOKEN_PREFIX)) return null;
  const inner = rawToken.slice(TOKEN_PREFIX.length);

  const dot = inner.indexOf('.');
  if (dot <= 0 || dot === inner.length - 1) return null;
  const payloadStr = inner.slice(0, dot);
  const providedSig = inner.slice(dot + 1);

  const key = hmacKey();
  if (!key) return null;

  const expectedSig = base64UrlEncode(
    createHmac('sha256', key).update(payloadStr, 'utf8').digest(),
  );
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const providedBuf = Buffer.from(providedSig, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, providedBuf)) return null;

  const decoded = base64UrlDecode(payloadStr);
  if (!decoded) return null;
  let payload: TokenPayload;
  try {
    payload = JSON.parse(decoded.toString('utf8')) as TokenPayload;
  } catch {
    return null;
  }
  if (payload.v !== TOKEN_VERSION) return null;
  if (typeof payload.lid !== 'string' || payload.lid.length === 0) return null;
  return { leadId: payload.lid };
}

// --- address composition + parsing -------------------------------------------

/** Compose the Reply-To address we set on an outbound email to a lead. The
 *  client's sender slug is used as the local-part base; the token appends
 *  via plus-addressing (RFC 5233 sub-addressing) so the visitor's reply lands
 *  back at the same mailbox and we resolve the lead from the token. */
export function composeReplyToAddress(clientSlug: string, threadToken: string): string {
  const domain = env.EMAIL_SENDING_DOMAIN;
  // The token already carries the `lead-` prefix; do not double it.
  return `${clientSlug}+${threadToken}@${domain}`;
}

/** Parse an inbound recipient address (the `to` of the inbound webhook
 *  delivery) back to (clientSlug, threadToken). Returns null when the address
 *  is not in the plus-addressed shape — a stray email to
 *  notifications@mail.webnua.com (or any non-plus address) gets null. The
 *  caller verifies the threadToken with parseThreadToken to resolve a leadId. */
export function parseInboundAddress(
  address: string,
): { clientSlug: string; threadToken: string } | null {
  if (typeof address !== 'string') return null;
  const lower = address.trim().toLowerCase();
  const at = lower.indexOf('@');
  if (at <= 0) return null;
  const local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  // Domain check is informational — Resend already delivers to our domain;
  // we accept the configured sending domain AND, defensively, any subdomain
  // routed to the same inbound webhook.
  const sendingDomain = env.EMAIL_SENDING_DOMAIN.toLowerCase();
  if (domain !== sendingDomain && !domain.endsWith(`.${sendingDomain}`)) {
    return null;
  }
  const plus = local.indexOf('+');
  if (plus <= 0 || plus === local.length - 1) return null;
  const clientSlug = local.slice(0, plus);
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
