// =============================================================================
// Design bundles — the 4 token sets the platform ships with.
//
// A bundle is a *coherent vocabulary*: radius scale + typography pairing +
// shadow depth + eyebrow style + icon style + spacing rhythm + button
// styling — chosen so any combination of section variants stamped with the
// same bundle looks intentional, not random. Sections do NOT pick a bundle
// per-section; the customer's whole site uses one bundle.
//
// Storage shape (decided in C2a audit):
//   brands.design_bundle_id  text NULL   one of the 4 ids below
//   NULL → resolve via industry default (lib/website/industry-bundle-defaults.ts)
//
// V1 ships data-model-only — a customer cannot pick / switch the bundle
// through the UI. V1.1 adds a bundle picker on /settings/brand. Until then
// the assignment is industry-driven at brand-create time.
//
// Adding a 5th bundle:
//   1. Add the id to DesignBundleId
//   2. Add the bundle object to DESIGN_BUNDLES
//   3. Decide industry assignments in lib/website/industry-bundle-defaults.ts
//   4. SectionShell will pick up the new bundle automatically via the
//      `--bundle-*` CSS custom properties it injects
//
// No migration needed for value additions — the column has no CHECK.
// =============================================================================

import type { GoogleFontId } from './google-fonts';

/** The closed set of bundle ids. Application-enforced; no DB CHECK. */
export type DesignBundleId =
  | 'sharp_direct'
  | 'warm_established'
  | 'clean_premium'
  | 'bold_direct';

export const ALL_BUNDLE_IDS: readonly DesignBundleId[] = [
  'sharp_direct',
  'warm_established',
  'clean_premium',
  'bold_direct',
];

/** True if the value is one of the closed bundle ids. */
export function isDesignBundleId(value: unknown): value is DesignBundleId {
  return (
    typeof value === 'string' &&
    (ALL_BUNDLE_IDS as readonly string[]).includes(value)
  );
}

/** Typography pairing — both ids are members of `CURATED_FONTS` (see
 *  `lib/website/google-fonts.ts`); SectionShell loads them through the
 *  existing GoogleFontLoader. */
export type BundleTypography = {
  heading: GoogleFontId;
  body: GoogleFontId;
};

/** Radius scale used by buttons / cards / inputs across bundle's sections.
 *  Values are CSS-ready px strings. */
export type BundleRadius = {
  /** Card / panel corner radius. */
  card: string;
  /** Button corner radius — typically same as `card`, occasionally tighter. */
  button: string;
  /** Input field corner radius — typically same as `button`. */
  input: string;
  /** Pill / chip radius — a big number for fully-rounded chips. */
  pill: string;
};

/** Shadow depth — bundle-wide elevation language. CSS box-shadow values. */
export type BundleShadow = {
  /** Card / panel resting shadow. */
  card: string;
  /** Elevated / hover state shadow. */
  elevation: string;
};

/** How the bundle treats eyebrow / mono / label text. */
export type BundleEyebrow =
  | 'none' // bundle deliberately omits eyebrows (Clean & Premium)
  | 'caps-tracking' // ALL CAPS, letter-spacing 0.1em (Sharp & Direct)
  | 'italic-mixed' // Mixed case italic, smaller weight (Warm & Established)
  | 'bold-coloured'; // Bold, brand accent colour (Bold & Direct)

/** Icon style — bundle-wide icon vocabulary. */
export type BundleIconStyle =
  | 'outlined-1.5'
  | 'filled-rounded'
  | 'hairline-1'
  | 'stacked-filled';

/** Spacing rhythm — base unit + section vertical padding range. */
export type BundleSpacing = {
  /** Base spacing unit in px — multiplied for paddings/margins. */
  base: number;
  /** Section vertical padding, narrower viewport (mobile/tablet). */
  sectionVertical: string;
  /** Section vertical padding, wider viewport (@2xl+ container query). */
  sectionVerticalWide: string;
};

/** Button language — drives the canonical CTA appearance per bundle. */
export type BundleButton =
  | 'solid-sharp-bold' // solid fill, sharp corners, bold weight
  | 'solid-soft-medium' // solid fill, soft (rounded) corners, medium weight
  | 'outlined-or-text' // outlined or text-only primary (Premium restraint)
  | 'big-bold-arrow'; // big, bold, with arrow / icon

/** A complete bundle definition. */
export type DesignBundle = {
  id: DesignBundleId;
  /** Operator-facing display name. */
  label: string;
  /** One-line description — for V1.1 picker UI + audit logs. */
  description: string;
  typography: BundleTypography;
  radius: BundleRadius;
  shadow: BundleShadow;
  eyebrow: BundleEyebrow;
  iconStyle: BundleIconStyle;
  spacing: BundleSpacing;
  button: BundleButton;
};

/** The 4 bundles. Source of truth — CSS custom properties are derived from
 *  these via `bundleCssVars()` below. */
export const DESIGN_BUNDLES: Record<DesignBundleId, DesignBundle> = {
  sharp_direct: {
    id: 'sharp_direct',
    label: 'Sharp & Direct',
    description:
      'Geometric, no-nonsense. Reads as licensed, technical, and emergency-ready.',
    typography: { heading: 'inter-tight', body: 'inter-tight' },
    radius: { card: '4px', button: '4px', input: '4px', pill: '4px' },
    shadow: {
      card: '0 1px 2px rgba(10, 10, 10, 0.08)',
      elevation: '0 2px 4px rgba(10, 10, 10, 0.12)',
    },
    eyebrow: 'caps-tracking',
    iconStyle: 'outlined-1.5',
    spacing: { base: 24, sectionVertical: '80px', sectionVerticalWide: '100px' },
    button: 'solid-sharp-bold',
  },
  warm_established: {
    id: 'warm_established',
    label: 'Warm & Established',
    description:
      'Soft corners and a settled rhythm — for businesses that earn return work through trust.',
    typography: { heading: 'fraunces', body: 'inter-tight' },
    radius: { card: '12px', button: '12px', input: '12px', pill: '999px' },
    shadow: {
      card: '0 4px 12px rgba(10, 10, 10, 0.08)',
      elevation: '0 8px 24px rgba(10, 10, 10, 0.12)',
    },
    eyebrow: 'italic-mixed',
    iconStyle: 'filled-rounded',
    spacing: { base: 32, sectionVertical: '100px', sectionVerticalWide: '120px' },
    button: 'solid-soft-medium',
  },
  clean_premium: {
    id: 'clean_premium',
    label: 'Clean & Premium',
    description:
      'Editorial calm — restrained colour, deliberate sharp corners, airy spacing.',
    // dm-serif-display is the closest "premium display" in CURATED_FONTS;
    // C2's brief named "Inter Display" but the curated set ships Inter Tight
    // only. Substituting a serif display reads more premium than a sans
    // would and matches the bundle's editorial framing.
    typography: { heading: 'dm-serif-display', body: 'inter-tight' },
    radius: { card: '0px', button: '0px', input: '0px', pill: '0px' },
    // None or hairline — modeled as transparent shadow + hairline borders
    // applied by section components.
    shadow: { card: '0 0 0 0 transparent', elevation: '0 0 0 0 transparent' },
    eyebrow: 'none',
    iconStyle: 'hairline-1',
    spacing: { base: 40, sectionVertical: '120px', sectionVerticalWide: '160px' },
    button: 'outlined-or-text',
  },
  bold_direct: {
    id: 'bold_direct',
    label: 'Bold & Direct',
    description:
      'Confident, energetic, and unmistakable. Big buttons, punchy rhythm, brand-coloured eyebrows.',
    // Fraunces Display + Inter Tight — same headline weight as
    // warm_established but with a punchier body pairing.
    typography: { heading: 'fraunces', body: 'inter-tight' },
    radius: { card: '8px', button: '8px', input: '8px', pill: '999px' },
    shadow: {
      card: '0 8px 16px rgba(10, 10, 10, 0.10)',
      elevation: '0 16px 32px rgba(10, 10, 10, 0.16)',
    },
    eyebrow: 'bold-coloured',
    iconStyle: 'stacked-filled',
    spacing: { base: 28, sectionVertical: '90px', sectionVerticalWide: '110px' },
    button: 'big-bold-arrow',
  },
};

/** Resolve a bundle id to its definition. Falls back to `bold_direct` (the
 *  most versatile bundle) when the input is null/undefined/unknown — a
 *  legacy row with no `design_bundle_id` resolves cleanly. */
export function getBundle(id: DesignBundleId | string | null | undefined): DesignBundle {
  if (id && isDesignBundleId(id)) return DESIGN_BUNDLES[id];
  return DESIGN_BUNDLES.bold_direct;
}

/** Produce the CSS custom-property map for a given bundle. SectionShell
 *  spreads this onto the section root so descendant components inherit
 *  bundle-aware styling via `var(--bundle-radius-card)` etc.
 *
 *  Naming convention: `--bundle-*` (this layer) is distinct from
 *  `--status-*` (the brand-tinted status colours, set separately by
 *  SectionShell) and from the global `--color-*` tokens (Webnua palette,
 *  defined in globals.css). */
export function bundleCssVars(bundle: DesignBundle): Record<string, string> {
  return {
    '--bundle-radius-card': bundle.radius.card,
    '--bundle-radius-button': bundle.radius.button,
    '--bundle-radius-input': bundle.radius.input,
    '--bundle-radius-pill': bundle.radius.pill,
    '--bundle-shadow-card': bundle.shadow.card,
    '--bundle-shadow-elevation': bundle.shadow.elevation,
    '--bundle-eyebrow-style': bundle.eyebrow,
    '--bundle-icon-style': bundle.iconStyle,
    '--bundle-spacing-base': `${bundle.spacing.base}px`,
    '--bundle-section-vertical': bundle.spacing.sectionVertical,
    '--bundle-section-vertical-wide': bundle.spacing.sectionVerticalWide,
    '--bundle-button-style': bundle.button,
  };
}
