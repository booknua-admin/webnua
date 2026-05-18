'use client';

// =============================================================================
// SectionShell — the shared full-bleed wrapper every uplifted section's
// Preview renders inside (Phase 6 · section-library uplift · Phase 0).
//
// Owns: the surface background + base body-text colour, the brand body font,
// loading the brand's Google Fonts, and a centred max-width content band.
//
// It deliberately REPLACES the old per-section `rounded-xl border bg-card`
// editor-card framing — an uplifted section renders edge-to-edge like a real
// website section, not a boxed schematic.
//
// `children` is a render-prop receiving the resolved SurfaceTokens + the
// heading / body font stacks + the brand accent, so a section colours its own
// headings and text against whichever surface it is on.
// =============================================================================

import type { ReactNode } from 'react';

import { getFont } from '@/lib/website/google-fonts';
import {
  getSurfaceTokens,
  type SectionSurface,
  type SurfaceTokens,
} from '@/lib/website/section-surface';
import type { BrandObject } from '@/lib/website/types';

import { GoogleFontLoader } from './GoogleFontLoader';

export type SectionShellRenderProps = {
  /** Resolved colour tokens for the active surface. */
  surface: SurfaceTokens;
  /** CSS font-family stack for display headings. */
  headingFont: string;
  /** CSS font-family stack for body copy. */
  bodyFont: string;
  /** The brand accent colour, passed through for convenience. */
  accent: string;
};

type SectionShellProps = {
  surface: SectionSurface;
  brand: BrandObject;
  /** Vertical padding scale. `default` suits most sections; `tight` for
   *  slim bands (CTA strips), `roomy` for heroes. */
  pad?: 'tight' | 'default' | 'roomy';
  /** Max width of the inner content band, in px. Default 1180. */
  maxWidth?: number;
  className?: string;
  children: (props: SectionShellRenderProps) => ReactNode;
};

const PAD: Record<NonNullable<SectionShellProps['pad']>, string> = {
  tight: 'py-12 md:py-14',
  default: 'py-16 md:py-20',
  roomy: 'py-20 md:py-28',
};

export function SectionShell({
  surface,
  brand,
  pad = 'default',
  maxWidth = 1180,
  className,
  children,
}: SectionShellProps) {
  const tokens = getSurfaceTokens(surface);
  const headingFont = getFont(brand.headingFont);
  const bodyFont = getFont(brand.bodyFont);

  return (
    <section
      data-surface={surface}
      className={`w-full px-6 md:px-10 ${PAD[pad]} ${className ?? ''}`}
      style={{
        backgroundColor: tokens.bg,
        color: tokens.body,
        fontFamily: bodyFont.stack,
      }}
    >
      <GoogleFontLoader fontIds={[headingFont.id, bodyFont.id]} />
      <div className="mx-auto w-full" style={{ maxWidth }}>
        {children({
          surface: tokens,
          headingFont: headingFont.stack,
          bodyFont: bodyFont.stack,
          accent: brand.accentColor,
        })}
      </div>
    </section>
  );
}
