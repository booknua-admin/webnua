'use client';

// =============================================================================
// SectionShell — the shared full-bleed wrapper every uplifted section's
// Preview renders inside (Phase 6 · section-library uplift).
//
// Owns: the surface background + base body-text colour, the brand body font,
// loading the brand's Google Fonts, and (in `band` inset) a centred
// max-width content band.
//
// It deliberately REPLACES the old per-section `rounded-xl border bg-card`
// editor-card framing — an uplifted section renders edge-to-edge like a real
// website section, not a boxed schematic.
//
// `children` is a render-prop receiving the resolved SurfaceTokens + the
// heading / body font stacks + the brand accent.
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
  /** Vertical padding scale. `none` for sections that self-manage spacing
   *  (heroes, bleeding-image layouts); `tight` for slim bands; `roomy` for
   *  generous sections. */
  pad?: 'none' | 'tight' | 'default' | 'roomy';
  /** `band` (default) centres content in a max-width column with horizontal
   *  padding. `flush` removes both — the section self-manages its insets
   *  (used by bleeding-image / overlay layouts). */
  inset?: 'band' | 'flush';
  /** Max width of the `band` content column, in px. Default 1180. */
  maxWidth?: number;
  /** Rendered absolutely behind the content — an image + scrim for overlay
   *  heroes, image-backed CTAs, etc. Makes the section `overflow-hidden`. */
  backgroundLayer?: ReactNode;
  className?: string;
  children: (props: SectionShellRenderProps) => ReactNode;
};

const PAD: Record<NonNullable<SectionShellProps['pad']>, string> = {
  none: '',
  tight: 'py-12 md:py-14',
  default: 'py-16 md:py-20',
  roomy: 'py-20 md:py-28',
};

export function SectionShell({
  surface,
  brand,
  pad = 'default',
  inset = 'band',
  maxWidth = 1180,
  backgroundLayer,
  className,
  children,
}: SectionShellProps) {
  const tokens = getSurfaceTokens(surface);
  const headingFont = getFont(brand.headingFont);
  const bodyFont = getFont(brand.bodyFont);
  const banded = inset === 'band';

  const sectionClass = [
    'relative w-full',
    backgroundLayer ? 'overflow-hidden' : '',
    banded ? 'px-6 md:px-10' : '',
    PAD[pad],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      data-surface={surface}
      className={sectionClass}
      style={{
        backgroundColor: tokens.bg,
        color: tokens.body,
        fontFamily: bodyFont.stack,
      }}
    >
      <GoogleFontLoader fontIds={[headingFont.id, bodyFont.id]} />
      {backgroundLayer ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {backgroundLayer}
        </div>
      ) : null}
      <div
        className={banded ? 'relative mx-auto w-full' : 'relative w-full'}
        style={banded ? { maxWidth } : undefined}
      >
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
