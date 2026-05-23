// =============================================================================
// Resend webhook signature verification.
//
// Phase 7 Resend session. Resend uses Svix's webhook signing scheme — the
// same shape Vercel / Clerk / GitHub webhooks use. The signature scheme:
//
//   • Three headers on every webhook request:
//       svix-id           — unique id for this delivery attempt.
//       svix-timestamp    — unix-seconds at sign time.
//       svix-signature    — space-separated list of `v1,<base64-sig>` entries.
//                            Each entry is one signing version's signature;
//                            we only verify v1 (HMAC-SHA256).
//   • The signed string is `{id}.{timestamp}.{raw-body}`.
//   • HMAC-SHA256 it with the webhook secret. The secret is base64-encoded
//     and prefixed `whsec_…` — strip the prefix and base64-decode before use.
//   • base64-encode the HMAC digest and compare to any of the `v1,…`
//     signatures supplied (Resend can include rolled-key versions).
//   • Timestamp tolerance — 5 minutes either side, to prevent replay.
//
// Implemented with node:crypto only — no Svix SDK.
//
// SERVER-ONLY.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

export type ResendVerifyResult = { ok: true } | { ok: false; reason: string };

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;
const SECRET_PREFIX = 'whsec_';

/**
 * Verify a Resend (Svix) webhook payload against its headers.
 *
 * @param rawBody    The exact raw request body bytes/string (NOT JSON-parsed).
 * @param headers    Object carrying svix-id / svix-timestamp / svix-signature.
 *                   Keys are case-insensitive; pass them however the runtime
 *                   gives them.
 * @param secret     The webhook secret from the Resend dashboard. Tolerates
 *                   the `whsec_` prefix.
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: Headers | Record<string, string | null | undefined>,
  secret: string,
): ResendVerifyResult {
  const get = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) return value ?? null;
    }
    return null;
  };

  const id = get('svix-id') ?? get('webhook-id');
  const timestamp = get('svix-timestamp') ?? get('webhook-timestamp');
  const signatures = get('svix-signature') ?? get('webhook-signature');

  if (!id || !timestamp || !signatures) {
    return { ok: false, reason: 'missing-headers' };
  }

  // Timestamp tolerance — reject anything older than 5 minutes.
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid-timestamp' };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'stale-timestamp' };
  }

  // Decode the secret. Resend prefixes it `whsec_` and base64-encodes the key.
  const cleaned = secret.startsWith(SECRET_PREFIX)
    ? secret.slice(SECRET_PREFIX.length)
    : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(cleaned, 'base64');
  } catch {
    return { ok: false, reason: 'invalid-secret' };
  }
  if (secretBytes.length === 0) return { ok: false, reason: 'invalid-secret' };

  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(signed, 'utf8').digest('base64');
  const expectedBuf = Buffer.from(expected, 'utf8');

  // Signature header is space-separated `v1,base64sig` entries; verify against
  // any v1 entry. Webhooks during key rotation carry two v1 entries.
  for (const entry of signatures.split(' ')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const comma = trimmed.indexOf(',');
    if (comma <= 0) continue;
    const scheme = trimmed.slice(0, comma);
    const sig = trimmed.slice(comma + 1);
    if (scheme !== 'v1') continue;
    const providedBuf = Buffer.from(sig, 'utf8');
    if (providedBuf.length !== expectedBuf.length) continue;
    if (timingSafeEqual(providedBuf, expectedBuf)) {
      return { ok: true };
    }
  }

  return { ok: false, reason: 'signature-mismatch' };
}
