// =============================================================================
// Derive a Twilio alphanumeric sender id from a business name.
//
// Pure helper — no I/O, no env, no DB. Called by the auto-assign service when
// a new client is provisioned (Pattern B conversational onboarding + the
// operator concierge create-client flow) to pick the alphanumeric string the
// background `twilio_register_sender_id` job submits to Twilio.
//
// Twilio constraints on alphanumeric senders:
//   - 1–11 characters
//   - ASCII letters + digits only (no spaces, hyphens, punctuation)
//   - at least one letter (a purely numeric sender is rejected)
//   - case-insensitive at Twilio's end but renders as submitted on recipient
//     devices; uppercase is the convention for visibility ("VOLTLINE",
//     "PLUMBCO" — easier to read on a lock screen)
//
// Algorithm:
//   1. Strip every non-alphanumeric character (handles spaces, ampersands,
//      apostrophes, emoji, accented characters).
//   2. Uppercase the result.
//   3. Truncate to MAX_LEN (11) — or to the suffix-aware truncation length
//      when a collision-resolution suffix is needed.
//   4. Guard: if the result has zero letters (empty or all-digits), fall back
//      to a deterministic `WEBNUA<N>` derivation from the fallback seed so the
//      client still gets a valid sender id rather than a 400 from Twilio.
//
// Collision handling:
//   Two businesses can produce the same sender id ("Smith Plumbing" + "Smith
//   Plumbers" both → "SMITHPLUMBI"). Webnua runs one Twilio Messaging Service
//   so an AlphaSender value must be unique within it. The auto-assign caller
//   passes a set of already-taken senders (via `existingSenders`); we try the
//   bare derivation first, then append a numeric suffix (`SMITHPLU2`,
//   `SMITHPLU3`, …) until we find a free one. Suffixes ≥10 collapse the base
//   further to keep the total ≤ MAX_LEN.
// =============================================================================

const MAX_LEN = 11;
const MIN_LEN = 1;

/** Twilio's character constraint, applied to the derivation output. */
const ALPHANUMERIC_RE = /^[A-Z0-9]{1,11}$/;

/** Result shape — separate `senderId` from `warnings` so the caller can
 *  surface advisory notes (e.g. "we stripped your emoji") without blocking. */
export type DerivedSenderId = {
  senderId: string;
  /** Advisory notes describing transforms applied (debug + audit). */
  warnings: string[];
};

export type DeriveSenderOptions = {
  /** Sender ids already in use across the Messaging Service. The derivation
   *  avoids these — appending a numeric suffix when the bare derivation
   *  collides. Case-insensitive comparison. */
  existingSenders?: ReadonlySet<string> | readonly string[];
  /** Deterministic fallback seed when the business name produces no letters
   *  (empty / all-digits / all-emoji). Most callers pass the client UUID or
   *  signup-attempt id so retries derive the same fallback. */
  fallbackSeed?: string;
};

/**
 * Derive an alphanumeric sender id from a business name + collision context.
 *
 * Deterministic: the same inputs always produce the same output, so a
 * background retry of the auto-assign job picks the same sender id.
 *
 * Never throws. The output always passes Twilio's format requirement
 * (1–11 alphanumeric chars, ≥1 letter).
 */
export function deriveAlphanumericSenderId(
  businessName: string,
  options: DeriveSenderOptions = {},
): DerivedSenderId {
  const warnings: string[] = [];
  const existing = toSet(options.existingSenders);

  // 1. Strip non-alphanumeric + uppercase.
  const stripped = (businessName ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (stripped !== (businessName ?? '').toUpperCase()) {
    warnings.push('stripped-non-alphanumeric');
  }

  // 2. Validate: must contain at least one letter. Empty or all-digit → fallback.
  const hasLetter = /[A-Z]/.test(stripped);
  if (!hasLetter) {
    const fallback = deriveFallback(options.fallbackSeed, existing);
    return { senderId: fallback.senderId, warnings: [...warnings, 'fallback-applied', ...fallback.warnings] };
  }

  // 3. Truncate to MAX_LEN. We need to know the suffix length ahead of time
  //    so the base + suffix fits inside MAX_LEN. Try suffix-free first; if it
  //    collides, retry with suffix-aware base truncation.
  const bare = stripped.slice(0, MAX_LEN);
  if (!existing.has(bare)) {
    return { senderId: bare, warnings };
  }

  // 4. Collision — try numeric suffix `<base><N>` for N = 2..99 (skip 1; "FOO1"
  //    looks like a typo; start at 2 as the human-readable "the second FOO").
  for (let suffix = 2; suffix <= 99; suffix++) {
    const suffixStr = String(suffix);
    const baseLen = MAX_LEN - suffixStr.length;
    if (baseLen < MIN_LEN) break;
    const baseTrunc = stripped.slice(0, baseLen);
    if (!/[A-Z]/.test(baseTrunc)) continue; // would collapse to all-digit
    const candidate = `${baseTrunc}${suffixStr}`;
    if (!existing.has(candidate)) {
      return { senderId: candidate, warnings: [...warnings, `collision-suffix-${suffix}`] };
    }
  }

  // 5. Exhausted — extremely unlikely (would need 99 colliding senders). Fall
  //    back to the deterministic fallback path.
  const fallback = deriveFallback(options.fallbackSeed, existing);
  return { senderId: fallback.senderId, warnings: [...warnings, 'exhausted-suffixes', ...fallback.warnings] };
}

// --- fallback ----------------------------------------------------------------

/** Deterministic fallback when the business name yields no usable letters.
 *
 *  Produces `WEBNUA<NN>` where NN is the first two hex chars of an FNV-1a hash
 *  of the seed, ensuring two distinct seeds (e.g. two different client UUIDs)
 *  pick distinct fallbacks. Within MAX_LEN. */
function deriveFallback(
  seed: string | undefined,
  existing: ReadonlySet<string>,
): DerivedSenderId {
  const warnings: string[] = [];
  const trimmedSeed = (seed ?? '').trim() || 'WEBNUA-CLIENT';
  const hash = fnv1aHex(trimmedSeed);
  for (let i = 0; i < hash.length - 1; i++) {
    const candidate = `WEBNUA${hash.slice(i, i + 2).toUpperCase()}`;
    if (candidate.length <= MAX_LEN && !existing.has(candidate)) {
      return { senderId: candidate, warnings };
    }
  }
  // Final escape — extremely unlikely.
  return { senderId: 'WEBNUA', warnings: ['fallback-final'] };
}

/** FNV-1a 32-bit hash → 8-hex string. Deterministic, no crypto dep. */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Coerce `existingSenders` to a case-folded Set for O(1) lookup. */
function toSet(input: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> {
  if (!input) return new Set();
  if (input instanceof Set) {
    const folded = new Set<string>();
    for (const value of input) folded.add(value.toUpperCase());
    return folded;
  }
  const folded = new Set<string>();
  for (const value of input as readonly string[]) folded.add(value.toUpperCase());
  return folded;
}

// --- validation --------------------------------------------------------------

/** Re-export the format check so callers can assert post-derivation. */
export function isValidAlphanumericSenderId(value: string): boolean {
  return ALPHANUMERIC_RE.test(value) && /[A-Z]/.test(value);
}
