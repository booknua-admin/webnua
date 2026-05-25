'use client';

// =============================================================================
// BundleButton — bundle-aware customer-facing CTA primitive (Bundle C2b-3).
//
// SectionShell injects per-bundle CSS custom properties on the section root:
//   --bundle-radius-button        4px (sharp_direct) → 12px (warm_established)
//   --bundle-button-style         solid-sharp-bold | solid-soft-medium |
//                                  outlined-or-text | big-bold-arrow
//   --bundle-shadow-elevation     hover/active elevation
//
// Until C2b-3 nothing read those variables — every section's CTA hard-coded
// `rounded-lg px-6 py-3` inline, so customers on Sharp & Direct looked
// identical to customers on Warm & Established. BundleButton is the primitive
// that closes the loop: it reads the variables and renders accordingly, so a
// bundle picker (V1.1) becomes a one-property switch site-wide.
//
// Variants:
//   - `primary`   — the high-emphasis CTA (filled by default; the
//                   `outlined-or-text` bundle reframes this as a strong
//                   outlined treatment instead of filled).
//   - `secondary` — the low-emphasis sibling (outlined by default; the
//                   `outlined-or-text` bundle reframes this as a text link).
//
// Behaviour rendered around SurfaceLink: live surface → real <a>; editor →
// inert <span> that stays click-to-select. The primitive does NOT swap that
// behaviour — every section CTA we replace still selects in the editor.
//
// What is NOT here:
//   - The shadcn `<Button>` primitive (operator UI). BundleButton is
//     customer-facing only. Operator settings / modals continue to use
//     `@/components/ui/button`.
//
// Migration: this PR adopts BundleButton in `about` + `features` (the two
// sections being uplifted alongside it) as the reference implementations.
// The remaining 7 customer-facing CTA sections (hero, offer, gallery,
// reviews, contact, cta, faq) keep their inline-styled SurfaceLinks until a
// follow-up session migrates them — visual regressions stay contained to the
// sections this PR is already changing.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { SurfaceLink } from './live-surface';

export type BundleButtonVariant = 'primary' | 'secondary';
export type BundleButtonSize = 'sm' | 'md' | 'lg';

export type BundleButtonProps = {
  /** Where the CTA points — page path, `tel:` / `mailto:`, external URL, or
   *  the `POPUP_HREF` sentinel. Pass through to SurfaceLink. */
  href?: string | null;
  variant?: BundleButtonVariant;
  size?: BundleButtonSize;
  /** Section accent colour — used as the fill / border / text colour. The
   *  caller resolves it through the section's brand-aware theme so we don't
   *  have to plumb the brand object down. */
  accent: string;
  /** Section's contrast colour for text-on-accent — typically `#ffffff` for
   *  light accents and `theme.heading` for very pale accents. Default `#fff`. */
  accentText?: string;
  /** Optional trailing glyph. The `big-bold-arrow` bundle promotes this to a
   *  permanent `→` when absent; other bundles render it as-supplied. */
  trailing?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Padding scale per size — the radius scale lives on the bundle, but vertical
 *  padding stays a per-button decision (a hero's primary CTA wants the larger
 *  rhythm; an inline link wants the small one). */
const SIZE_PADDING: Record<BundleButtonSize, string> = {
  sm: 'px-4 py-2 text-[13px]',
  md: 'px-6 py-3 text-[14px]',
  lg: 'px-7 py-3.5 text-[15px]',
};

/** Font-weight per bundle.button — read off the CSS custom property at runtime
 *  via inline style so each bundle gets the right weight without burning a
 *  className per bundle. */
const WEIGHT_BY_BUNDLE: Record<string, string> = {
  'solid-sharp-bold': '700',
  'solid-soft-medium': '500',
  'outlined-or-text': '500',
  'big-bold-arrow': '700',
};

function resolveWeight(bundleStyle: string | undefined): string {
  if (!bundleStyle) return '600';
  return WEIGHT_BY_BUNDLE[bundleStyle] ?? '600';
}

/** Browser-side helper: read a CSS custom property off `document.body` (the
 *  SectionShell-injected vars hang off the section root, but the body inherits
 *  enough to resolve them when this component is mounted inside that subtree).
 *  Falls back to a sensible default per the bundle docs. We resolve at render
 *  time rather than baking into a className so a bundle switch reactively
 *  re-renders every BundleButton. */
function readCssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  // Read off the documentElement so we pick up the closest section's bundle
  // vars via CSS cascade. Returns the empty string when the property is
  // unset (e.g. inside the editor preview before SectionShell mounted).
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Resolve the BundleButton's render-time treatment. Pure — takes only the
 *  variant + the four CSS-resolvable inputs. */
function buttonTreatment(
  variant: BundleButtonVariant,
  bundleStyle: string,
  accent: string,
  accentText: string,
): { className: string; style: CSSProperties } {
  const weight = resolveWeight(bundleStyle);
  // `outlined-or-text` is the Clean & Premium register — the primary CTA is
  // OUTLINED (not filled) and the secondary CTA degrades to a text link.
  const isPremiumText = bundleStyle === 'outlined-or-text';

  if (variant === 'primary') {
    if (isPremiumText) {
      // Outlined primary — hairline border in the accent colour.
      return {
        className:
          'inline-flex items-center gap-2 border-2 transition-shadow hover:shadow-[var(--bundle-shadow-elevation)]',
        style: {
          borderColor: accent,
          color: accent,
          backgroundColor: 'transparent',
          borderRadius: 'var(--bundle-radius-button, 8px)',
          fontWeight: weight,
        },
      };
    }
    return {
      className:
        'inline-flex items-center gap-2 transition-shadow hover:shadow-[var(--bundle-shadow-elevation)]',
      style: {
        backgroundColor: accent,
        color: accentText,
        borderRadius: 'var(--bundle-radius-button, 8px)',
        fontWeight: weight,
      },
    };
  }

  // secondary
  if (isPremiumText) {
    // Text link — no border, no padding, just underline-on-hover.
    return {
      className:
        'inline-flex items-center gap-2 underline-offset-4 hover:underline',
      style: { color: accent, fontWeight: weight },
    };
  }
  return {
    className:
      'inline-flex items-center gap-2 border-2 transition-colors hover:bg-black/[0.03]',
    style: {
      borderColor: accent,
      color: accent,
      backgroundColor: 'transparent',
      borderRadius: 'var(--bundle-radius-button, 8px)',
      fontWeight: weight,
    },
  };
}

/** The primitive. Renders a SurfaceLink so editor click-to-select still
 *  works; visual treatment is bundle-aware via the CSS custom properties
 *  injected on the section root. */
export function BundleButton({
  href,
  variant = 'primary',
  size = 'md',
  accent,
  accentText = '#ffffff',
  trailing,
  className,
  style,
  children,
}: BundleButtonProps) {
  // Read the bundle's button style at render time so a bundle switch (or a
  // wrapping section with a different bundle context — multi-bundle pages
  // aren't a thing today, but the cost of being right is zero) re-renders.
  const bundleStyle = readCssVar('--bundle-button-style', 'solid-soft-medium');
  const treatment = buttonTreatment(variant, bundleStyle, accent, accentText);
  // The Big & Bold bundle promotes the trailing glyph to a permanent `→`
  // when the caller didn't pass one — its defining "with arrow / icon" tic.
  const trailingNode =
    trailing ??
    (bundleStyle === 'big-bold-arrow' ? (
      <span aria-hidden>→</span>
    ) : null);

  // `outlined-or-text` secondary skips padding (it's a text link).
  const isPremiumTextSecondary = variant === 'secondary' && bundleStyle === 'outlined-or-text';
  const padding = isPremiumTextSecondary ? '' : SIZE_PADDING[size];

  return (
    <SurfaceLink
      href={href}
      className={cn(treatment.className, padding, className)}
      style={{ ...treatment.style, ...style }}
    >
      {children}
      {trailingNode}
    </SurfaceLink>
  );
}
