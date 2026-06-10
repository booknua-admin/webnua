// =============================================================================
// Unsubscribe tokens — HMAC-signed customer opt-out links (SERVER-ONLY).
//
// Every automation-driven customer-facing email carries
// `{appBase}/api/email/unsubscribe?t={token}` in its footer. The token is an
// HMAC-signed (customerId) payload — unforgeable, no DB row needed, and it
// never expires (an unsubscribe link in a year-old email must still work).
// The HMAC key resolves UNSUBSCRIBE/OAUTH_STATE_SECRET → service-role key,
// the same fallback chain the thread-token HMAC uses.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

import { env, getAppBaseUrl } from '@/lib/env';

const VERSION = 'v1';

function hmacKey(): string {
  const key = env.OAUTH_STATE_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Unsubscribe-token signing has no key — set OAUTH_STATE_SECRET (or SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  return key;
}

function b64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', hmacKey()).update(payload).digest());
}

/** `v1.{customerId}.{signature}` — customerId is a UUID (no dots). */
export function generateUnsubscribeToken(customerId: string): string {
  const payload = `${VERSION}.${customerId}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a token; returns the customerId or null. */
export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [version, customerId, signature] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return null;
  const expected = sign(`${version}.${customerId}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return customerId;
}

/** The absolute unsubscribe URL for a customer, or null when no app base
 *  URL resolves (a footer must never carry a relative link). */
export function composeUnsubscribeUrl(customerId: string): string | null {
  const base = getAppBaseUrl();
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/api/email/unsubscribe?t=${encodeURIComponent(
    generateUnsubscribeToken(customerId),
  )}`;
}
