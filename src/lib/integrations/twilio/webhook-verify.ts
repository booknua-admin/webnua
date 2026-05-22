// =============================================================================
// Twilio webhook signature verification.
//
// Phase 7 Twilio SMS session. Twilio signs every webhook request (the SMS
// status callback) with the X-Twilio-Signature header. The scheme, for a POST:
//
//   1. Take the full request URL Twilio called (scheme + host + path + query).
//   2. Append every POST parameter, sorted by key, as `key + value`
//      concatenated with no separator.
//   3. HMAC-SHA1 the result with the account Auth Token as the key.
//   4. Base64-encode it.
//   5. A valid request matches the X-Twilio-Signature header.
//
// Implemented with node:crypto only — no Twilio SDK. Pure + unit-testable.
//
// SERVER-ONLY.
// =============================================================================

import { createHmac, timingSafeEqual } from 'node:crypto';

export type TwilioVerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Verify a Twilio webhook POST against its X-Twilio-Signature header.
 *
 * @param url        The exact URL Twilio called (the configured StatusCallback).
 * @param params     The POST form parameters as a flat string map.
 * @param signature  The X-Twilio-Signature header value.
 * @param authToken  The Twilio account Auth Token (the HMAC key).
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string,
): TwilioVerifyResult {
  if (!signature) return { ok: false, reason: 'missing-signature' };

  // The signed string: the URL, then each sorted key immediately followed by
  // its value.
  let signed = url;
  for (const key of Object.keys(params).sort()) {
    signed += key + params[key];
  }

  const expected = createHmac('sha1', authToken).update(signed, 'utf8').digest('base64');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, reason: 'signature-mismatch' };
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, reason: 'signature-mismatch' };
  }
  return { ok: true };
}
