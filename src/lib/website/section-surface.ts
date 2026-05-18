// =============================================================================
// Section surfaces — the four named tonal surfaces an uplifted section can
// render on (Phase 6 · section-library uplift · Phase 0).
//
// Orthogonal to a section's `layout`: any layout renders on any surface.
// Together (`layout` × `surface`) they reproduce the "4 examples per section"
// reference grid without an explosion of section types.
//
// Deliberately NOT global @theme tokens — surfaces are a section-library
// concern, not a platform palette. They reference the Webnua palette values
// where it maps; the one genuinely new value (the navy `dark` surface) is a
// constant here, not a protected-block palette token.
// =============================================================================

export type SectionSurface = 'paper' | 'white' | 'light' | 'dark';

export const SECTION_SURFACES: readonly SectionSurface[] = [
  'paper',
  'white',
  'light',
  'dark',
] as const;

/** The default surface a freshly-added section renders on. */
export const DEFAULT_SECTION_SURFACE: SectionSurface = 'white';

export type SurfaceTokens = {
  /** Section background. */
  bg: string;
  /** Heading / display text colour. */
  heading: string;
  /** Body / paragraph text colour. */
  body: string;
  /** Eyebrow + quiet meta text colour. */
  muted: string;
  /** Hairline / divider colour. */
  border: string;
  /** Background for a card nested on this surface. */
  cardBg: string;
  /** Border for a card nested on this surface. */
  cardBorder: string;
  /** True for dark surfaces — lets a section flip imagery treatment,
   *  shadow strength, overlay direction, etc. */
  isDark: boolean;
};

const SURFACES: Record<SectionSurface, SurfaceTokens> = {
  // Webnua's signature warm off-white.
  paper: {
    bg: '#f5f1ea',
    heading: '#0a0a0a',
    body: '#4a4a45',
    muted: '#6e685c',
    border: '#d8d0bf',
    cardBg: '#ffffff',
    cardBorder: '#e0d8c8',
    isDark: false,
  },
  // Clean white — the most neutral surface.
  white: {
    bg: '#ffffff',
    heading: '#0a0a0a',
    body: '#4a4a45',
    muted: '#6e685c',
    border: '#ebe5d9',
    cardBg: '#faf8f4',
    cardBorder: '#ebe5d9',
    isDark: false,
  },
  // Cool light grey — adds contrast against white neighbours.
  light: {
    bg: '#eef1f5',
    heading: '#0a0a0a',
    body: '#454b54',
    muted: '#6b7280',
    border: '#dde1e8',
    cardBg: '#ffffff',
    cardBorder: '#e4e7ed',
    isDark: false,
  },
  // Deep navy — the dark surface from the reference set. Genuinely new to
  // Webnua (the palette `ink` is near-black, not navy); a section-library
  // constant, not a platform token.
  dark: {
    bg: '#0d1f3a',
    heading: '#ffffff',
    body: '#c4cdda',
    muted: '#8b97ab',
    border: 'rgba(255, 255, 255, 0.12)',
    cardBg: '#15294a',
    cardBorder: 'rgba(255, 255, 255, 0.10)',
    isDark: true,
  },
};

export function getSurfaceTokens(surface: SectionSurface): SurfaceTokens {
  return SURFACES[surface] ?? SURFACES[DEFAULT_SECTION_SURFACE];
}
