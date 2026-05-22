// =============================================================================
// Phone normalisation — best-effort coercion of a freeform phone number into
// E.164 (the format Twilio requires: +<country><number>).
//
// Lead-capture forms collect phone numbers as freeform text — "087 123 4567",
// "(01) 555 0142", "+353 87 123 4567". Twilio rejects anything that is not
// E.164. normalizePhone() does a best-effort conversion using the deployment's
// default country (TWILIO_DEFAULT_COUNTRY) for numbers given in national form.
//
// This is a heuristic, NOT a full libphonenumber. It handles the common cases
// (already-E.164, 00-prefixed international, leading-0 national); a number it
// cannot confidently normalise is returned as-is and Twilio will reject it,
// surfacing as a failed sms_messages row — an honest failure, not a silent
// wrong-number send.
//
// SERVER + CLIENT safe — pure, no imports.
// =============================================================================

/** ISO-3166 country → international dialling code, for the countries Webnua
 *  operates in. Extend as new markets are added. */
const COUNTRY_DIAL_CODE: Record<string, string> = {
  IE: '353',
  GB: '44',
  UK: '44',
  US: '1',
  CA: '1',
  AU: '61',
  NZ: '64',
};

export type PhoneNormalizeResult = {
  /** The E.164 number, or the cleaned input when it could not be normalised. */
  e164: string;
  /** True when the result is a well-formed E.164 number. */
  ok: boolean;
};

/**
 * Normalise a freeform phone number to E.164. `defaultCountry` (an ISO-3166
 * alpha-2 code) is used to expand a number given in national form.
 */
export function normalizePhone(raw: string, defaultCountry = 'IE'): PhoneNormalizeResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { e164: '', ok: false };

  // Strip everything except digits and a leading +.
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/[^\d]/g, '');

  // Already +international.
  if (hasPlus) {
    return finalize(`+${digits}`);
  }
  // 00 international prefix → +.
  if (digits.startsWith('00')) {
    return finalize(`+${digits.slice(2)}`);
  }

  const dialCode = COUNTRY_DIAL_CODE[defaultCountry.toUpperCase()];
  if (!dialCode) {
    // Unknown default country — cannot expand a national number. Return what
    // we have; Twilio will reject it and the failure is recorded honestly.
    return { e164: digits ? `+${digits}` : '', ok: false };
  }

  // National form with a trunk-prefix 0 (Irish / UK / AU style) → drop the 0,
  // prepend the dial code.
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
    return finalize(`+${dialCode}${digits}`);
  }
  // Already carries the country dial code without a + (e.g. "353871234567").
  if (digits.startsWith(dialCode)) {
    return finalize(`+${digits}`);
  }
  // Bare national number with no trunk 0 — assume the default country.
  return finalize(`+${dialCode}${digits}`);
}

/** E.164 is "+" then 8–15 digits. */
function finalize(candidate: string): PhoneNormalizeResult {
  const ok = /^\+\d{8,15}$/.test(candidate);
  return { e164: candidate, ok };
}
