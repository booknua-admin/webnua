// =============================================================================
// Section themes — the per-section colour model (Phase 6 · section-library
// uplift). A section stores colour *overrides*; the effective colour resolves
// down a chain:
//
//   section override  ??  brand default  ??  section hardcoded default
//
// So a brand-level default (set by the user's "apply to all", or by the AI
// builder when it picks a palette) flows into every section that has not
// overridden that colour — while a section keeps a sensible look of its own
// when nothing is set.
//
// THEME_PRESETS are full themes shown as circle swatches. Themes are plain
// hex (the colour picker emits hex) so mixing is exact.
// =============================================================================

/** A complete set of the three section colours. */
export type ThemeColors = {
  background: string;
  heading: string;
  body: string;
};

/** A section's stored colours — every field optional (absent = inherit). */
export type SectionTheme = Partial<ThemeColors>;

/** Fully-resolved tokens a section's Preview renders against. */
export type ResolvedTheme = ThemeColors & {
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
  theme: ThemeColors;
};

/** The ultimate fallback when nothing up the chain has a value. */
export const DEFAULT_SECTION_THEME: ThemeColors = {
  background: '#ffffff',
  heading: '#0a0a0a',
  body: '#4a4a45',
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

/** Id of the preset matching this theme exactly, or null when customised /
 *  partial. */
export function matchPresetId(theme: SectionTheme): string | null {
  const eq = (a: string | undefined, b: string) =>
    !!a && a.toLowerCase() === b.toLowerCase();
  const found = THEME_PRESETS.find(
    (p) =>
      eq(theme.background, p.theme.background) &&
      eq(theme.heading, p.theme.heading) &&
      eq(theme.body, p.theme.body),
  );
  return found?.id ?? null;
}

/** Build a SectionTheme from a brand's colour defaults, omitting unset
 *  keys (so they fall through to the next link in the resolve chain). */
export function brandThemeDefaults(
  brand:
    | { headingColor?: string; bodyColor?: string; backgroundColor?: string }
    | null
    | undefined,
): SectionTheme {
  const t: SectionTheme = {};
  if (brand?.backgroundColor) t.background = brand.backgroundColor;
  if (brand?.headingColor) t.heading = brand.headingColor;
  if (brand?.bodyColor) t.body = brand.bodyColor;
  return t;
}

/** Resolve a section's colours down the override → brand → hardcoded chain. */
export function resolveTheme(
  overrides: SectionTheme,
  brandDefaults?: SectionTheme,
  hardcoded?: SectionTheme,
): ResolvedTheme {
  const pick = (k: keyof ThemeColors): string =>
    overrides[k] ??
    brandDefaults?.[k] ??
    hardcoded?.[k] ??
    DEFAULT_SECTION_THEME[k];

  const background = pick('background');
  const heading = pick('heading');
  const body = pick('body');
  const isDark = luminance(background) < 0.5;

  return {
    background,
    heading,
    body,
    muted: mixHex(body, background, 0.32),
    border: mixHex(body, background, 0.84),
    card: mixHex(background, heading, isDark ? 0.08 : 0.04),
    cardBorder: mixHex(background, heading, isDark ? 0.18 : 0.1),
    isDark,
  };
}

// -- Surface macro ------------------------------------------------------------
// The sanctioned per-section colour knob the AI is allowed to use (the parked
// "section themes" decision anticipated exactly this). The model never emits
// raw `theme` colours — it emits a `surface` from this closed set, and the
// generation/edit pipelines map it to concrete, CONTRAST-SAFE theme overrides
// derived from the brand accent. Surfaces give a page light/dark rhythm
// ("custom-designed" feel) without re-opening the text-on-bg contrast bugs
// that got raw theme emission banned.

export type SectionSurface = 'default' | 'tinted' | 'dark' | 'accent';

export const SECTION_SURFACES: readonly SectionSurface[] = [
  'default',
  'tinted',
  'dark',
  'accent',
];

export function isSectionSurface(v: unknown): v is SectionSurface {
  return typeof v === 'string' && (SECTION_SURFACES as readonly string[]).includes(v);
}

/** Map a surface choice to concrete theme overrides built from the brand
 *  accent. Every pairing is contrast-safe by construction:
 *  - `default` → no overrides (brand defaults / section hardcoded apply);
 *  - `tinted`  → a soft accent-washed near-white with near-black text;
 *  - `dark`    → an accent-tinted near-black with light text;
 *  - `accent`  → the accent itself, text flipped by the accent's luminance. */
export function surfaceThemeOverrides(
  surface: SectionSurface,
  accent: string,
): SectionTheme {
  switch (surface) {
    case 'default':
      return {};
    case 'tinted':
      return {
        background: mixHex(accent, '#ffffff', 0.93),
        heading: mixHex(accent, '#121110', 0.88),
        body: mixHex(accent, '#45433e', 0.84),
      };
    case 'dark':
      return {
        background: mixHex(accent, '#0d0e12', 0.88),
        heading: '#ffffff',
        body: mixHex(accent, '#d4d5da', 0.8),
      };
    case 'accent': {
      const dark = isColorDark(accent);
      return {
        background: accent,
        heading: dark ? '#ffffff' : mixHex(accent, '#15130e', 0.9),
        body: dark
          ? mixHex(accent, '#ffffff', 0.82)
          : mixHex(accent, '#2c2a24', 0.84),
      };
    }
  }
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

/** True when a colour is dark enough to want light text on top of it. */
export function isColorDark(hex: string): boolean {
  return luminance(hex) < 0.5;
}
