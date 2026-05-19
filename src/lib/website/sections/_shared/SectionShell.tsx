'use client';

// =============================================================================
// SectionShell — the shared full-bleed wrapper every uplifted section's
// Preview renders inside (Phase 6 · section-library uplift).
//
// Owns: the section background + base body-text colour (from the section's
// editable colour theme), the brand body font, loading the brand's Google
// Fonts, and (in `band` inset) a centred max-width content band.
//
// It deliberately REPLACES the old per-section `rounded-xl border bg-card`
// editor-card framing — an uplifted section renders edge-to-edge like a real
// website section, not a boxed schematic.
//
// `children` is a render-prop receiving the resolved theme tokens + the
// heading / body font stacks + the brand accent.
// =============================================================================

import type { ReactNode } from 'react';

import { FormBlock } from '@/components/shared/website/FormBlock';
import { getFont } from '@/lib/website/google-fonts';
import type { ResolvedTheme } from '@/lib/website/section-theme';
import type { BrandObject } from '@/lib/website/types';

import { GoogleFontLoader } from './GoogleFontLoader';
import { useSectionFormSlot } from './section-form-slot';

export type SectionShellRenderProps = {
  /** Resolved colour tokens for the section's theme. */
  theme: ResolvedTheme;
  /** CSS font-family stack for display headings. */
  headingFont: string;
  /** CSS font-family stack for body copy. */
  bodyFont: string;
  /** The brand accent colour, passed through for convenience. */
  accent: string;
};

type SectionShellProps = {
  /** The section's resolved colour theme (the Preview resolves it against
   *  the brand defaults before passing it down). */
  theme: ResolvedTheme;
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
  /** Form slot placement. `auto` (default) — when the section has an
   *  attached form, SectionShell renders it within the band. `self` — the
   *  section places the form itself (the hero's column); SectionShell skips
   *  it so it is not rendered twice. */
  formSlot?: 'auto' | 'self';
  className?: string;
  children: (props: SectionShellRenderProps) => ReactNode;
};

// Container-query padding — responds to the section's own width (the device
// preview), not the browser viewport.
const PAD: Record<NonNullable<SectionShellProps['pad']>, string> = {
  none: '',
  tight: 'py-12 @2xl:py-14',
  default: 'py-16 @2xl:py-20',
  roomy: 'py-20 @2xl:py-28',
};

export function SectionShell({
  theme,
  brand,
  pad = 'default',
  inset = 'band',
  maxWidth = 1180,
  backgroundLayer,
  formSlot = 'auto',
  className,
  children,
}: SectionShellProps) {
  const tokens = theme;
  const headingFont = getFont(brand.headingFont);
  const bodyFont = getFont(brand.bodyFont);
  const banded = inset === 'band';
  // When the section has an attached form and isn't placing it itself,
  // render it within this band so it reads as part of the section.
  const slot = useSectionFormSlot();
  const renderForm = formSlot === 'auto' && slot != null;

  const sectionClass = [
    // `@container` makes the section a container-query context, so its
    // responsive classes track the device-preview width, not the viewport.
    'relative w-full @container',
    backgroundLayer ? 'overflow-hidden' : '',
    banded ? 'px-8 @2xl:px-12' : '',
    PAD[pad],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={sectionClass}
      style={{
        backgroundColor: tokens.background,
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
          theme: tokens,
          headingFont: headingFont.stack,
          bodyFont: bodyFont.stack,
          accent: brand.accentColor,
        })}
        {renderForm && slot ? (
          <div className={banded ? 'mx-auto mt-10 w-full max-w-[480px]' : 'mt-10 w-full'}>
            <FormBlock
              form={slot.form}
              brand={slot.brand}
              selectedElement={slot.selectedElement}
              onSelectElement={slot.onSelectElement}
              testSubmitCtx={slot.testSubmitCtx}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
