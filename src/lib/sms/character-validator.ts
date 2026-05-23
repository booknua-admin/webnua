// =============================================================================
// SMS character validator — pure, dependency-free.
//
// An SMS is encoded as either GSM-7 (the carrier default alphabet) or UCS-2
// (UTF-16, used the moment a single non-GSM character appears). The encoding
// decides how many characters fit in one segment, and a message is billed
// per segment — so a stray curly quote can silently double the cost of every
// send by flipping a 160-char GSM message into a 70-char UCS-2 one.
//
// validateTemplate() reports, for any string:
//   • whether it is GSM-7-clean,
//   • which exact characters are not GSM-7,
//   • the segment count + encoding,
//   • human-readable warnings for the common culprits (curly quotes,
//     em-dashes, ellipses, emoji, accented characters, multi-segment cost).
//
// The GSM 03.38 alphabet is encoded verbatim below — the basic set (1 septet
// each) and the extension set (2 septets each: ^ { } \ [ ~ ] | € and FF).
//
// SERVER + CLIENT safe — pure functions, no imports.
// =============================================================================

// --- GSM 03.38 alphabet ------------------------------------------------------

// The GSM-7 basic alphabet. Every character here costs one septet. Note this
// DOES include a set of accented characters (è é ù ì ò à ä ö ñ ü Ä Ö Ñ Ü Å å
// Æ æ ß É Ç Ø ø) and the Greek capitals — but NOT á í ó ú â ê etc., which is
// why "accented character" is a per-character question, not a blanket one.
const GSM_BASIC = new Set(
  (
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ' +
    ' !"#¤%&\'()*+,-./0123456789:;<=>?' +
    '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§' +
    '¿abcdefghijklmnopqrstuvwxyzäöñüà'
  ).split(''),
);

// The GSM-7 extension set. Each costs TWO septets (an escape + the character).
const GSM_EXTENDED = new Set('\f^{}\\[~]|€'.split(''));

/** Per-encoding segment capacities (characters / septets per segment). */
export const SEGMENT_LIMITS = {
  gsm: { single: 160, multi: 153 },
  ucs2: { single: 70, multi: 67 },
} as const;

// --- types -------------------------------------------------------------------

export type SegmentEncoding = 'gsm' | 'ucs2';

export type ValidationWarningCode =
  | 'curly_quote'
  | 'smart_dash'
  | 'ellipsis'
  | 'non_breaking_space'
  | 'emoji'
  | 'non_gsm_character'
  | 'multi_segment';

export type ValidationWarning = {
  code: ValidationWarningCode;
  message: string;
  /** The distinct offending characters, when the warning is character-driven. */
  characters: string[];
};

export type TemplateValidation = {
  /** True when every character is in the GSM-7 alphabet. */
  isGSMCompatible: boolean;
  /** The distinct characters that are not GSM-7 (drives the UCS-2 fallback). */
  nonGSMCharacters: string[];
  /** Visible character count — Unicode code points (1 emoji = 1). */
  length: number;
  /** Number of SMS segments the message will be split into. */
  segments: number;
  segmentEncoding: SegmentEncoding;
  warnings: ValidationWarning[];
};

// --- smart-character maps ----------------------------------------------------

// Curly / typographic quotes — none are GSM-7.
const CURLY_QUOTES = new Set('‘’‚‛“”„‟'.split(''));
// Em / en / figure dashes + the Unicode minus sign — none are GSM-7.
const SMART_DASHES = new Set('‒–—―−'.split(''));
const ELLIPSIS = '…';
const NON_BREAKING_SPACE = ' ';

// The ASCII the "fix smart characters" action substitutes in.
const SMART_REPLACEMENTS: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '‛': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '‟': '"',
  '‒': '-',
  '–': '-',
  '—': '-',
  '―': '-',
  '−': '-',
  '…': '...',
  ' ': ' ',
};

// Extended-pictographic covers emoji + most pictographic symbols.
const EMOJI_RE = /\p{Extended_Pictographic}/u;

// --- public API --------------------------------------------------------------

/** True when every character in `text` is GSM-7 encodable. */
export function isGSMCompatible(text: string): boolean {
  for (const ch of text) {
    if (!GSM_BASIC.has(ch) && !GSM_EXTENDED.has(ch)) return false;
  }
  return true;
}

/**
 * Validate a template (or a rendered SMS body). Pure — same input always
 * yields the same report. Works on a template with {{placeholders}} as well
 * as on a rendered message; `{` and `}` are valid GSM-7 (extended) characters,
 * so a placeholder-bearing template is still GSM-compatible.
 */
export function validateTemplate(template: string): TemplateValidation {
  const codePoints = [...template];
  const length = codePoints.length;

  // --- encoding + non-GSM characters -----------------------------------------
  const nonGSMSet = new Set<string>();
  for (const ch of codePoints) {
    if (!GSM_BASIC.has(ch) && !GSM_EXTENDED.has(ch)) nonGSMSet.add(ch);
  }
  const isGSM = nonGSMSet.size === 0;
  const segmentEncoding: SegmentEncoding = isGSM ? 'gsm' : 'ucs2';

  // --- segment count ---------------------------------------------------------
  const segments = countSegments(template, segmentEncoding);

  // --- warnings --------------------------------------------------------------
  const warnings = buildWarnings(codePoints, nonGSMSet, segments);

  return {
    isGSMCompatible: isGSM,
    nonGSMCharacters: [...nonGSMSet],
    length,
    segments,
    segmentEncoding,
    warnings,
  };
}

/**
 * The number of segments `text` occupies under `encoding`. GSM counts septets
 * (extended characters cost 2); UCS-2 counts UTF-16 code units (an emoji is a
 * surrogate pair = 2). The single/multi split is the standard SMS rule: a
 * message that fits the single-segment limit is 1 segment, otherwise it is
 * split into multi-segment parts.
 *
 * Note: this is the industry-standard approximation. It does not model an
 * extended GSM character or an emoji surrogate pair being pushed to the next
 * segment when it would straddle a boundary — a sub-one-character effect that
 * does not change the cost estimate for the short transactional messages this
 * is built for.
 */
export function countSegments(text: string, encoding: SegmentEncoding): number {
  const units = encoding === 'gsm' ? gsmSeptets(text) : utf16Units(text);
  if (units === 0) return 0;
  const limits = SEGMENT_LIMITS[encoding];
  if (units <= limits.single) return 1;
  return Math.ceil(units / limits.multi);
}

/** The GSM-7 septet count of `text` — extended characters cost 2. */
export function gsmSeptets(text: string): number {
  let septets = 0;
  for (const ch of text) septets += GSM_EXTENDED.has(ch) ? 2 : 1;
  return septets;
}

/** UTF-16 code-unit count — the unit UCS-2 segment limits are measured in. */
function utf16Units(text: string): number {
  return text.length;
}

/**
 * Replace smart punctuation (curly quotes, em/en-dashes, ellipsis,
 * non-breaking space) with the GSM-7 ASCII equivalent. Emoji and genuinely
 * non-GSM accented characters are NOT touched — there is no safe automatic
 * substitution for them, so they stay (and stay flagged).
 */
export function fixSmartCharacters(text: string): string {
  let out = '';
  for (const ch of text) out += SMART_REPLACEMENTS[ch] ?? ch;
  return out;
}

/** True when `text` contains at least one auto-fixable smart character. */
export function hasFixableSmartCharacters(text: string): boolean {
  for (const ch of text) {
    if (ch in SMART_REPLACEMENTS) return true;
  }
  return false;
}

// --- internals ---------------------------------------------------------------

function buildWarnings(
  codePoints: string[],
  nonGSM: Set<string>,
  segments: number,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const curly = distinct(codePoints, (ch) => CURLY_QUOTES.has(ch));
  if (curly.length > 0) {
    warnings.push({
      code: 'curly_quote',
      characters: curly,
      message:
        `Curly quote ${quoteList(curly)} detected — it is not a GSM-7 character, ` +
        'so the whole message is sent as UCS-2 (70 characters per segment ' +
        'instead of 160), increasing cost. Replace it with a straight quote.',
    });
  }

  const dashes = distinct(codePoints, (ch) => SMART_DASHES.has(ch));
  if (dashes.length > 0) {
    warnings.push({
      code: 'smart_dash',
      characters: dashes,
      message:
        `Em-dash / en-dash ${quoteList(dashes)} detected — not GSM-7; it forces ` +
        'UCS-2 encoding. Replace it with a hyphen "-".',
    });
  }

  const ellipsis = distinct(codePoints, (ch) => ch === ELLIPSIS);
  if (ellipsis.length > 0) {
    warnings.push({
      code: 'ellipsis',
      characters: ellipsis,
      message:
        'Ellipsis character "…" detected — not GSM-7; it forces UCS-2 ' +
        'encoding. Replace it with three dots "...".',
    });
  }

  const nbsp = distinct(codePoints, (ch) => ch === NON_BREAKING_SPACE);
  if (nbsp.length > 0) {
    warnings.push({
      code: 'non_breaking_space',
      characters: nbsp,
      message:
        'Non-breaking space detected — not GSM-7; it forces UCS-2 encoding. ' +
        'Replace it with a normal space.',
    });
  }

  const emoji = distinct(codePoints, (ch) => EMOJI_RE.test(ch));
  if (emoji.length > 0) {
    warnings.push({
      code: 'emoji',
      characters: emoji,
      message:
        `Emoji ${quoteList(emoji)} detected — emoji force UCS-2 encoding, which ` +
        'roughly halves the characters that fit in one segment.',
    });
  }

  // Any non-GSM character not already explained by a more specific warning
  // above — typically an accented letter (á, í, ñ-variants outside GSM, …).
  const explained = new Set<string>([...curly, ...dashes, ...ellipsis, ...nbsp, ...emoji]);
  const otherNonGSM = [...nonGSM].filter((ch) => !explained.has(ch));
  if (otherNonGSM.length > 0) {
    warnings.push({
      code: 'non_gsm_character',
      characters: otherNonGSM,
      message:
        `Non-GSM character ${quoteList(otherNonGSM)} detected — this forces UCS-2 ` +
        'encoding (70 characters per segment instead of 160).',
    });
  }

  if (segments > 1) {
    warnings.push({
      code: 'multi_segment',
      characters: [],
      message:
        `This message is ${segments} segments long — each segment is billed ` +
        `separately, so it costs about ${segments}× a single SMS.`,
    });
  }

  return warnings;
}

/** The distinct code points of `codePoints` matching `predicate`, in order. */
function distinct(codePoints: string[], predicate: (ch: string) => boolean): string[] {
  const seen = new Set<string>();
  for (const ch of codePoints) {
    if (predicate(ch)) seen.add(ch);
  }
  return [...seen];
}

/** Render a character list as `"a", "b"` for a warning message. */
function quoteList(chars: string[]): string {
  return chars.map((ch) => `"${ch}"`).join(', ');
}
