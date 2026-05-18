// =============================================================================
// Section themes — the per-section colour model (Phase 6 · section-library
// uplift). Replaces the fixed 4-surface enum: a section now carries an
// editable colour theme — 6 presets shown as circle swatches, each colour
// adjustable with a colour picker.
//
// A theme is three editable colours (background / heading / body); the
// remaining tokens (muted, border, card) are derived so the editing UI
// stays small. The brand accent colour is applied on top, unchanged — brand
// consistency is not a per-section choice.
//
// Deliberately NOT global @theme tokens — a section-library concern. Themes
// are plain hex (the colour picker emits hex), so mixing is exact.
// =============================================================================

/** The three editable colours a section stores. */
export type SectionTheme = {
  background: string;
  heading: string;
  body: string;
};

/** Fully-resolved tokens a section's Preview renders against. */
export type ResolvedTheme = {
  background: string;
  heading: string;
  body: string;
  /** Eyebrow / quiet meta text — body, lightened toward the background. */
  muted: string;
  /** Hairline / divider. */
  border: string;
  /** Background for a card nested on this surface. */
  card: string;
  /** Border for a nested card. */
  cardBorder: string;
  /** True when the background is dark — lets a section flip treatment. */
  isDark: boolean;
};

export type SectionThemePreset = {
  id: string;
  label: string;
  theme: SectionTheme;
};

/** The starter themes shown as circle swatches in the theme picker. */
export const THEME_PRESETS: readonly SectionThemePreset[] = [
  { id: 'midnight', label: 'Midnight', theme: { background: '#0d1f3a', heading: '#ffffff', body: '#c4cdda' } },
  { id: 'ink', label: 'Ink', theme: { background: '#17181c', heading: '#ffffff', body: '#b6b8bf' } },
  { id: 'white', label: 'White', theme: { background: '#ffffff', heading: '#0a0a0a', body: '#4a4a45' } },
  { id: 'paper', label: 'Paper', theme: { background: '#f5f1ea', heading: '#0a0a0a', body: '#4a4a45' } },
  { id: 'slate', label: 'Slate', theme: { background: '#eef1f5', heading: '#11151c', body: '#464c55' } },
  { id: 'sand', label: 'Sand', theme: { background: '#ece2d2', heading: '#2b2218', body: '#5c5142' } },
];

/** The neutral default — a fresh section starts white. */
export const DEFAULT_SECTION_THEME: SectionTheme = {
  background: '#ffffff',
  heading: '#0a0a0a',
  body: '#4a4a45',
};

/** Id of the preset matching this theme exactly, or null when customised. */
export function matchPresetId(theme: SectionTheme): string | null {
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const found = THEME_PRESETS.find(
    (p) =>
      eq(p.theme.background, theme.background) &&
      eq(p.theme.heading, theme.heading) &&
      eq(p.theme.body, theme.body),
  );
  return found?.id ?? null;
}

export function resolveTheme(theme: SectionTheme): ResolvedTheme {
  const isDark = luminance(theme.background) < 0.5;
  return {
    background: theme.background,
    heading: theme.heading,
    body: theme.body,
    muted: mixHex(theme.body, theme.background, 0.32),
    border: mixHex(theme.body, theme.background, 0.84),
    card: mixHex(theme.background, theme.heading, isDark ? 0.08 : 0.04),
    cardBorder: mixHex(theme.background, theme.heading, isDark ? 0.18 : 0.1),
    isDark,
  };
}

// -- hex helpers ------------------------------------------------------------

/** Mix colour `a` toward `b` by `t` (0 = a, 1 = b). */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = Number.parseInt(h || '000000', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => {
        const c = Math.max(0, Math.min(255, Math.round(v)));
        return c.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

/** Relative luminance 0..1 (sRGB approximation). */
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
