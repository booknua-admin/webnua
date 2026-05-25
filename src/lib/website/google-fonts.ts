// =============================================================================
// Curated Google Fonts — the starter set a brand picks its heading + body
// font from (Phase 6 · section-library uplift · Phase 0).
//
// next/font is build-time and cannot load a runtime brand-chosen font, so
// brand fonts load via the css2 stylesheet API (see GoogleFontLoader).
//
// Phase 0 ships a CURATED list, not a browse-all-1500 picker — the full
// picker lands later alongside a brand-editing surface. BrandObject stores a
// font *id* from this list (`headingFont` / `bodyFont`); the eventual
// browse-everything picker can widen this to an arbitrary `{ family, weights }`
// without changing the consuming code.
// =============================================================================

export type GoogleFontCategory = 'sans' | 'serif';

/** The closed set of curated font ids. Widens to `string` when the
 *  browse-everything picker lands; for now design bundles + brand storage
 *  type-check against this union. */
export type GoogleFontId =
  | 'inter-tight'
  | 'manrope'
  | 'plus-jakarta-sans'
  | 'archivo'
  | 'sora'
  | 'playfair-display'
  | 'fraunces'
  | 'dm-serif-display'
  | 'lora'
  | 'spectral';

export type GoogleFont = {
  /** Stable id stored on BrandObject. */
  id: GoogleFontId;
  /** The Google Fonts family name (for display in a picker). */
  family: string;
  category: GoogleFontCategory;
  /** Full CSS font-family stack, including fallbacks. */
  stack: string;
  /** The `family=` query segment for the css2 API (family + weights). */
  apiParam: string;
};

export const CURATED_FONTS: readonly GoogleFont[] = [
  {
    id: 'inter-tight',
    family: 'Inter Tight',
    category: 'sans',
    stack: "'Inter Tight', system-ui, sans-serif",
    apiParam: 'Inter+Tight:wght@400;500;600;700;800',
  },
  {
    id: 'manrope',
    family: 'Manrope',
    category: 'sans',
    stack: "'Manrope', system-ui, sans-serif",
    apiParam: 'Manrope:wght@400;500;600;700;800',
  },
  {
    id: 'plus-jakarta-sans',
    family: 'Plus Jakarta Sans',
    category: 'sans',
    stack: "'Plus Jakarta Sans', system-ui, sans-serif",
    apiParam: 'Plus+Jakarta+Sans:wght@400;500;600;700;800',
  },
  {
    id: 'archivo',
    family: 'Archivo',
    category: 'sans',
    stack: "'Archivo', system-ui, sans-serif",
    apiParam: 'Archivo:wght@400;500;600;700;800',
  },
  {
    id: 'sora',
    family: 'Sora',
    category: 'sans',
    stack: "'Sora', system-ui, sans-serif",
    apiParam: 'Sora:wght@400;500;600;700;800',
  },
  {
    id: 'playfair-display',
    family: 'Playfair Display',
    category: 'serif',
    stack: "'Playfair Display', Georgia, serif",
    apiParam: 'Playfair+Display:wght@400;500;600;700;800',
  },
  {
    id: 'fraunces',
    family: 'Fraunces',
    category: 'serif',
    stack: "'Fraunces', Georgia, serif",
    apiParam: 'Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700',
  },
  {
    id: 'dm-serif-display',
    family: 'DM Serif Display',
    category: 'serif',
    stack: "'DM Serif Display', Georgia, serif",
    apiParam: 'DM+Serif+Display:ital@0;1',
  },
  {
    id: 'lora',
    family: 'Lora',
    category: 'serif',
    stack: "'Lora', Georgia, serif",
    apiParam: 'Lora:wght@400;500;600;700',
  },
  {
    id: 'spectral',
    family: 'Spectral',
    category: 'serif',
    stack: "'Spectral', Georgia, serif",
    apiParam: 'Spectral:wght@400;500;600;700;800',
  },
];

/** The platform default — used when a brand has not chosen a font. */
export const DEFAULT_FONT_ID = 'inter-tight';

/** Resolve a font id to its definition; falls back to the platform default. */
export function getFont(id: string | null | undefined): GoogleFont {
  return (
    CURATED_FONTS.find((f) => f.id === id) ??
    CURATED_FONTS.find((f) => f.id === DEFAULT_FONT_ID)!
  );
}

/** The css2 stylesheet href that loads the given fonts, deduped. Returns
 *  null when the id list resolves to nothing. */
export function googleFontsHref(ids: readonly string[]): string | null {
  const seen = new Set<string>();
  const fonts: GoogleFont[] = [];
  for (const id of ids) {
    const font = getFont(id);
    if (seen.has(font.id)) continue;
    seen.add(font.id);
    fonts.push(font);
  }
  if (fonts.length === 0) return null;
  const families = fonts.map((f) => `family=${f.apiParam}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
