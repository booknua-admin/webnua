// =============================================================================
// Stripe webhook signature verification.
//
// Phase 7 Stripe billing session. Verifies the Stripe-Signature header against
// STRIPE_WEBHOOK_SECRET, implementing Stripe's documented signing scheme so we
// do not need the Stripe SDK for it:
//
//   • The header is `t=<unix ts>,v1=<hex sig>[,v1=<hex sig>…][,v0=…]`.
//   • The signed payload is `<t>.<raw request body>`.
//   • The expected signature is HMAC-SHA256(signed payload, signing secret),
//     hex-encoded.
//   • A valid request matches one of the v1 signatures (Stripe can roll secrets
//     and send several) and is within a timestamp tolerance (replay defence).
//
// Pure + dependency-free (node:crypto only) — unit-testable in isolation.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { StripeEvent } from './types';

/** Default replay tolerance — Stripe's own default. */
const DEFAULT_TOLERANCE_SECONDS = 300;

export type WebhookVerifyResult = { ok: true; event: StripeEvent } | { ok: false; reason: string };

/** Verify a raw Stripe webhook body against its signature header. Returns the
 *  parsed event on success, or a machine-readable failure reason. */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): WebhookVerifyResult {
  if (!signatureHeader) return { ok: false, reason: 'missing-signature' };

  // Parse `t=…,v1=…,v1=…` into the timestamp + the candidate v1 signatures.
  let timestamp = '';
  const v1Signatures: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) {
    return { ok: false, reason: 'malformed-signature' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'malformed-timestamp' };
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) {
    return { ok: false, reason: 'timestamp-out-of-tolerance' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const matched = v1Signatures.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, 'utf8');
    return candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf);
  });
  if (!matched) return { ok: false, reason: 'signature-mismatch' };

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  if (
    !event ||
    typeof event !== 'object' ||
    typeof (event as StripeEvent).type !== 'string' ||
    typeof (event as StripeEvent).data !== 'object'
  ) {
    return { ok: false, reason: 'unexpected-event-shape' };
  }
  return { ok: true, event: event as StripeEvent };
}
