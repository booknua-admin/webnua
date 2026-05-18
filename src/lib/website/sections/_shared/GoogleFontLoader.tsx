'use client';

// =============================================================================
// GoogleFontLoader — injects the css2 stylesheet <link> for a set of curated
// Google Font ids (Phase 6 · section-library uplift · Phase 0).
//
// next/font is build-time; a brand's runtime-chosen font loads via the css2
// API. SectionShell renders one of these so any uplifted section preview has
// its brand fonts available. React 19 / Next hoist a rendered <link> into
// <head> automatically and de-duplicate identical hrefs.
// =============================================================================

import { googleFontsHref } from '@/lib/website/google-fonts';

export function GoogleFontLoader({ fontIds }: { fontIds: readonly string[] }) {
  const href = googleFontsHref(fontIds);
  if (!href) return null;
  return <link rel="stylesheet" href={href} />;
}
