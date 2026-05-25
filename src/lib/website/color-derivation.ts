// =============================================================================
// Color derivation engine — Bundle C2b-1.
//
// Customer provides 1–2 brand colours; this module derives the full palette
// the customer's site renders against:
//
//   - Primary tints (50/100/200) and shades (700/800/900)
//   - Secondary (auto-derived via HSL rotation if absent; validated if
//     provided)
//   - Neutrals (warm-stone / cool-slate / pure-grey, picked by primary
//     temperature)
//   - Surfaces (page / card / dark — the 3-tier surface scale)
//   - Status tints (success / warning / error / info — all derived from
//     primary so they read on-brand, not generic)
//   - Text colours WCAG-AA validated against every background
//
// Pure, no I/O, no React. Persistable as `DerivedPalette` JSON to
// `brands.derived_palette`; recomputable at render time from a brand row's
// primary + (optional) secondary.
//
// No dependency. ~30 lines of HSL math + the WCAG relative-luminance formula
// + the Lab-distance heuristic for "too close in hue" — all stdlib. Matches
// the existing `mixHex` + `luminance` style in `section-theme.ts`.
//
// WCAG AA targets:
//   - 4.5:1 for body text on background
//   - 3:1 for large text (≥18pt, or ≥14pt bold)
//   - 3:1 for non-text UI (button borders, icons) — not validated here
// =============================================================================

import { isColorDark, mixHex } from './section-theme';

// ---- hex / hsl / luminance primitives ---------------------------------------

/** Parse `#rrggbb` (or `#rgb`) to [0..255, 0..255, 0..255]. */
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

/** Pack [r, g, b] (each 0..255) back to `#rrggbb`. */
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

/** HSL channel triple, h in [0, 360), s/l in [0, 1]. */
type HSL = { h: number; s: number; l: number };

/** Convert hex → HSL. */
function hexToHsl(hex: string): HSL {
  const [r8, g8, b8] = parseHex(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

/** Convert HSL → hex. */
function hslToHex({ h, s, l }: HSL): string {
  const hue = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return toHex(v, v, v);
  }
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** WCAG relative luminance (per §1.4.3 / sRGB → linear → weighted sum). */
function relativeLuminance(hex: string): number {
  const [r8, g8, b8] = parseHex(hex);
  const channel = (c8: number): number => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r8) + 0.7152 * channel(g8) + 0.0722 * channel(b8);
}

/** WCAG contrast ratio between two colours. Returns ≥1 (1 = identical). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when `text` reaches WCAG AA contrast against `bg` for body copy. */
export function passesAaBody(text: string, bg: string): boolean {
  return contrastRatio(text, bg) >= 4.5;
}

/** True when `text` reaches WCAG AA contrast against `bg` for large text
 *  (≥18pt, or ≥14pt bold). */
export function passesAaLarge(text: string, bg: string): boolean {
  return contrastRatio(text, bg) >= 3.0;
}

// ---- palette types ----------------------------------------------------------

/** A primary or secondary brand colour, plus its full tint/shade scale. */
export type BrandColorScale = {
  /** The source brand colour. */
  base: string;
  /** Very light tints — used for soft surfaces, subtle highlights. */
  tint50: string;
  tint100: string;
  tint200: string;
  /** Darker shades — used for hover/pressed states + ink-on-primary. */
  shade700: string;
  shade800: string;
  shade900: string;
};

/** Three-tier surface scale: page > card > dark band. */
export type SurfaceScale = {
  /** Page background — near-white, slightly tinted with primary's temperature. */
  surface1: string;
  /** Elevated card / panel — true white or near-white. */
  surface2: string;
  /** Dark band / inverse section — near-black with a slight primary tint. */
  surface3: string;
};

/** Status / alert colours derived from the brand primary so they read
 *  on-brand instead of as generic green/amber/red. */
export type StatusPalette = {
  /** Positive / success — primary at high lightness, hue shifted toward green. */
  success: string;
  /** Warning — primary at moderate lightness, hue held. */
  warning: string;
  /** Error / destructive — primary's complement at high saturation. */
  error: string;
  /** Informational — primary at moderate lightness, hue shifted toward blue. */
  info: string;
};

/** Text colours validated against every background tier. */
export type TextPalette = {
  /** Body text on a light surface (surface1 / surface2). WCAG AA 4.5:1. */
  onLight: string;
  /** Body text on a dark surface (surface3). WCAG AA 4.5:1. */
  onDark: string;
  /** Body text on the primary colour. White or near-black per primary luma. */
  onPrimary: string;
  /** Body text on the secondary colour. */
  onSecondary: string;
};

/** Neutrals — temperature-matched to the primary so the page reads coherent. */
export type NeutralPalette = {
  /** Hairlines / dividers (light surfaces). */
  border: string;
  /** Muted text (eyebrows, captions). */
  muted: string;
  /** Inputs / disabled surfaces (very light). */
  surfaceAlt: string;
};

/** The full derived palette — the shape persisted as `brands.derived_palette`. */
export type DerivedPalette = {
  /** Version stamp — bump when the shape changes incompatibly so readers
   *  can re-derive on the fly instead of trying to consume stale data. */
  version: 1;
  primary: BrandColorScale;
  secondary: BrandColorScale;
  /** True when `secondary` was auto-derived (no customer-provided colour). */
  secondaryAutoDerived: boolean;
  /** True when the customer's secondary was within 20° of primary's hue
   *  and we silently rotated it for harmony. Surfaceable in UI ("we adjusted
   *  your secondary for contrast") if a future picker wants to show it. */
  secondaryAdjusted: boolean;
  neutrals: NeutralPalette;
  surfaces: SurfaceScale;
  text: TextPalette;
  status: StatusPalette;
};

// ---- derivation logic -------------------------------------------------------

/** Adjust a colour's lightness to `target` (0..1), preserving hue + sat. */
function setLightness(hex: string, target: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: Math.max(0, Math.min(1, target)) });
}

/** Build the 6-stop tint + shade scale for a brand colour. The base value
 *  sits between tint200 and shade700 — readers pick which scale step to
 *  use per surface. */
function buildScale(base: string): BrandColorScale {
  return {
    base,
    tint50: setLightness(base, 0.96),
    tint100: setLightness(base, 0.9),
    tint200: setLightness(base, 0.78),
    shade700: setLightness(base, 0.34),
    shade800: setLightness(base, 0.22),
    shade900: setLightness(base, 0.12),
  };
}

/** Auto-derive a secondary from primary via HSL rotation. Per the C2 spec:
 *  rotate 30–45° for a harmonious accent; adjust saturation if primary is
 *  very saturated so the accent doesn't shout louder than the brand. */
function deriveSecondaryFromPrimary(primary: string): string {
  const hsl = hexToHsl(primary);
  // 38° rotation — middle of the 30-45 band, lands cleanly between
  // analogous (30°) and triadic-adjacent (45°).
  const rotated: HSL = { ...hsl, h: hsl.h + 38 };
  // Soften saturation slightly if primary is very saturated so the
  // derived accent supports rather than competes.
  if (hsl.s > 0.7) rotated.s = Math.max(0.5, hsl.s * 0.85);
  return hslToHex(rotated);
}

/** Validate a customer-provided secondary. If it's within 20° of primary's
 *  hue (too close to read as a distinct accent), rotate it for harmony.
 *  Returns the (possibly adjusted) secondary + a flag indicating adjustment. */
function validateSecondary(
  primary: string,
  secondary: string,
): { color: string; adjusted: boolean } {
  const ph = hexToHsl(primary).h;
  const sh = hexToHsl(secondary).h;
  // Minimum angular separation between two hues on the circle [0, 180].
  const diff = Math.min(Math.abs(ph - sh), 360 - Math.abs(ph - sh));
  if (diff < 20) {
    return { color: deriveSecondaryFromPrimary(primary), adjusted: true };
  }
  return { color: secondary, adjusted: false };
}

/** Temperature classification — warm/cool/neutral primary drives neutral
 *  selection. Hues 350-30 (red/orange) + 30-60 (orange/yellow) are warm;
 *  150-270 (cyan/blue) are cool; everything else is neutral-leaning. */
type Temperature = 'warm' | 'cool' | 'neutral';
function classifyTemperature(hex: string): Temperature {
  const { h, s } = hexToHsl(hex);
  // Very desaturated primaries (navy, charcoal) → neutral palette regardless
  // of hue — a brand that picks #2a2a2a doesn't want a warm-stone palette.
  if (s < 0.15) return 'neutral';
  const hue = ((h % 360) + 360) % 360;
  if (hue >= 330 || hue < 60) return 'warm';
  if (hue >= 150 && hue < 270) return 'cool';
  return 'neutral';
}

/** Build the neutral palette + surface scale for a given temperature. */
function buildNeutralsAndSurfaces(
  primary: string,
  temperature: Temperature,
): { neutrals: NeutralPalette; surfaces: SurfaceScale } {
  // The neutral hex bases — slightly tinted toward primary's temperature.
  // Conservative tinting (5-8%) so the palette reads coherent, not stained.
  const isDarkPrimary = isColorDark(primary);
  const tintAmount = 0.06;

  if (temperature === 'warm') {
    // Warm primaries → warm-stone neutrals (slight yellow-brown tint).
    const stone = '#e9e3d8';
    const stoneBorder = '#d7cfbf';
    const stoneMuted = '#7a7468';
    return {
      neutrals: {
        border: stoneBorder,
        muted: stoneMuted,
        surfaceAlt: stone,
      },
      surfaces: {
        // Page background — near-white with a hint of primary warmth.
        surface1: mixHex('#fafafa', primary, tintAmount),
        // Card surface — true white, no tint, so cards visually lift.
        surface2: '#ffffff',
        // Dark band — near-black with primary tint.
        surface3: mixHex('#0a0a0a', primary, isDarkPrimary ? 0.04 : 0.08),
      },
    };
  }

  if (temperature === 'cool') {
    // Cool primaries → cool-slate neutrals (slight blue-grey tint).
    const slate = '#e6ebef';
    const slateBorder = '#cdd5dd';
    const slateMuted = '#6a737b';
    return {
      neutrals: {
        border: slateBorder,
        muted: slateMuted,
        surfaceAlt: slate,
      },
      surfaces: {
        surface1: mixHex('#fafbfc', primary, tintAmount),
        surface2: '#ffffff',
        surface3: mixHex('#0a0d12', primary, isDarkPrimary ? 0.04 : 0.08),
      },
    };
  }

  // Neutral primaries (navy, charcoal, neutral browns) → pure greys.
  return {
    neutrals: {
      border: '#d4d4d4',
      muted: '#6e6e6e',
      surfaceAlt: '#ececec',
    },
    surfaces: {
      surface1: '#fafafa',
      surface2: '#ffffff',
      surface3: '#0a0a0a',
    },
  };
}

/** Pick the highest-contrast option from a set of candidates against a
 *  background. Returns the candidate that maximises WCAG contrast. */
function pickHighestContrast(bg: string, candidates: readonly string[]): string {
  let best = candidates[0];
  let bestRatio = contrastRatio(best, bg);
  for (let i = 1; i < candidates.length; i += 1) {
    const r = contrastRatio(candidates[i], bg);
    if (r > bestRatio) {
      best = candidates[i];
      bestRatio = r;
    }
  }
  return best;
}

/** Build the text palette — every value WCAG AA validated. Falls back to
 *  pure black / white when no tinted candidate clears the bar (so a wild
 *  primary like neon yellow still produces readable text). */
function buildTextPalette(
  primary: string,
  secondary: string,
  surfaces: SurfaceScale,
  temperature: Temperature,
): TextPalette {
  // Tinted candidates — preferred when they pass AA. Pure black/white are
  // the fallback when a tinted candidate would fail.
  const inkTintBase = '#0a0a0a';
  const paperTintBase = '#f7f4ee';

  // Ink-on-light: prefer ink slightly tinted toward primary's temperature
  // for warmth/cohesion. Fall through to pure black if needed.
  const inkOnLight =
    temperature === 'warm'
      ? mixHex(inkTintBase, primary, 0.08)
      : temperature === 'cool'
        ? mixHex(inkTintBase, primary, 0.06)
        : inkTintBase;

  // Paper-on-dark: prefer paper slightly tinted toward primary.
  const paperOnDark =
    temperature === 'warm'
      ? mixHex(paperTintBase, primary, 0.04)
      : temperature === 'cool'
        ? mixHex(paperTintBase, primary, 0.04)
        : paperTintBase;

  // Validate against surface1 (the page background) for body text. If a
  // tinted ink fails AA on the page bg, fall back to pure black.
  const onLight = passesAaBody(inkOnLight, surfaces.surface1) ? inkOnLight : '#000000';
  const onDark = passesAaBody(paperOnDark, surfaces.surface3) ? paperOnDark : '#ffffff';

  // Text-on-primary — pick whichever has more contrast. Apply the same
  // logic to text-on-secondary.
  const onPrimary = pickHighestContrast(primary, [paperOnDark, inkOnLight, '#ffffff', '#000000']);
  const onSecondary = pickHighestContrast(secondary, [
    paperOnDark,
    inkOnLight,
    '#ffffff',
    '#000000',
  ]);

  return { onLight, onDark, onPrimary, onSecondary };
}

/** Build the status palette — every status colour derived from primary so
 *  the customer's site uses on-brand alerts. Replaces hardcoded
 *  green/amber/red triad. */
function buildStatusPalette(primary: string): StatusPalette {
  const hsl = hexToHsl(primary);
  // Success — push hue toward green (120°), high lightness for a soft
  // success treatment.
  const successHsl: HSL = { h: 140, s: Math.max(0.35, hsl.s * 0.7), l: 0.4 };
  // Warning — keep hue (primary IS the warning palette) at moderate lightness.
  const warningHsl: HSL = { h: hsl.h, s: Math.max(0.55, hsl.s), l: 0.48 };
  // Error — primary's complement at high saturation (so it visually
  // distinguishes from primary).
  const errorHsl: HSL = { h: hsl.h + 180, s: 0.7, l: 0.5 };
  // Info — push hue toward blue (210°).
  const infoHsl: HSL = { h: 210, s: 0.5, l: 0.45 };
  return {
    success: hslToHex(successHsl),
    warning: hslToHex(warningHsl),
    error: hslToHex(errorHsl),
    info: hslToHex(infoHsl),
  };
}

// ---- public API -------------------------------------------------------------

/** Inputs to `derivePalette`. `industry` is captured for future industry-
 *  aware tuning but not currently consumed — the derivation is purely
 *  colour-mathematical for V1. */
export type DerivePaletteInput = {
  primary: string;
  secondary?: string;
  industry?: string;
};

/** Derive the full palette from 1–2 brand colours.
 *
 *  Pure — no side effects, no I/O. The returned `DerivedPalette` is the
 *  shape persisted to `brands.derived_palette`. Re-running with the same
 *  inputs yields the same output (idempotent). */
export function derivePalette(input: DerivePaletteInput): DerivedPalette {
  const primary = input.primary;
  let secondary: string;
  let secondaryAutoDerived = false;
  let secondaryAdjusted = false;

  if (input.secondary && input.secondary.trim().length > 0) {
    const v = validateSecondary(primary, input.secondary);
    secondary = v.color;
    secondaryAdjusted = v.adjusted;
  } else {
    secondary = deriveSecondaryFromPrimary(primary);
    secondaryAutoDerived = true;
  }

  const temperature = classifyTemperature(primary);
  const { neutrals, surfaces } = buildNeutralsAndSurfaces(primary, temperature);
  const text = buildTextPalette(primary, secondary, surfaces, temperature);
  const status = buildStatusPalette(primary);

  return {
    version: 1,
    primary: buildScale(primary),
    secondary: buildScale(secondary),
    secondaryAutoDerived,
    secondaryAdjusted,
    neutrals,
    surfaces,
    text,
    status,
  };
}

/** Produce the CSS custom-property map for a derived palette. SectionShell
 *  spreads this onto the section root so descendant components inherit
 *  brand-tinted styling via `var(--palette-primary)` etc.
 *
 *  Naming convention: `--palette-*` (this layer), `--status-*` (status
 *  tints, same source), `--bundle-*` (typography/radius/shadow, separate
 *  layer in `design-bundles.ts`), `--color-*` (global Webnua palette,
 *  defined in `globals.css`). */
export function paletteCssVars(palette: DerivedPalette): Record<string, string> {
  return {
    '--palette-primary': palette.primary.base,
    '--palette-primary-tint-50': palette.primary.tint50,
    '--palette-primary-tint-100': palette.primary.tint100,
    '--palette-primary-tint-200': palette.primary.tint200,
    '--palette-primary-shade-700': palette.primary.shade700,
    '--palette-primary-shade-800': palette.primary.shade800,
    '--palette-primary-shade-900': palette.primary.shade900,
    '--palette-secondary': palette.secondary.base,
    '--palette-secondary-tint-50': palette.secondary.tint50,
    '--palette-secondary-tint-100': palette.secondary.tint100,
    '--palette-secondary-tint-200': palette.secondary.tint200,
    '--palette-secondary-shade-700': palette.secondary.shade700,
    '--palette-secondary-shade-800': palette.secondary.shade800,
    '--palette-secondary-shade-900': palette.secondary.shade900,
    '--palette-surface-1': palette.surfaces.surface1,
    '--palette-surface-2': palette.surfaces.surface2,
    '--palette-surface-3': palette.surfaces.surface3,
    '--palette-text-on-light': palette.text.onLight,
    '--palette-text-on-dark': palette.text.onDark,
    '--palette-text-on-primary': palette.text.onPrimary,
    '--palette-text-on-secondary': palette.text.onSecondary,
    '--palette-border': palette.neutrals.border,
    '--palette-muted': palette.neutrals.muted,
    '--palette-surface-alt': palette.neutrals.surfaceAlt,
    // Status colours — the brand-tinted siblings of the global
    // --color-good/warn/info tokens in globals.css. SectionShell sets
    // these on the section root so descendant components reading
    // `var(--status-good, var(--color-good))` get the brand tint when in
    // a customer-site context and the global fallback elsewhere.
    '--status-good': palette.status.success,
    '--status-warn': palette.status.warning,
    '--status-error': palette.status.error,
    '--status-info': palette.status.info,
  };
}

// ---- shape validation (cheap, for reading persisted JSON) -------------------

/** Cheap runtime guard — does the unknown look like a v1 palette? Used by
 *  readers of `brands.derived_palette` to decide whether to consume or
 *  re-derive from primary. */
export function isDerivedPalette(value: unknown): value is DerivedPalette {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return false;
  return (
    typeof v.primary === 'object' &&
    typeof v.secondary === 'object' &&
    typeof v.surfaces === 'object' &&
    typeof v.text === 'object' &&
    typeof v.status === 'object'
  );
}
