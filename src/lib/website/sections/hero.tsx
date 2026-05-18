'use client';

import { BuilderFormRow, BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import type { ResolvedTheme, SectionTheme } from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { MediaField } from './_shared/MediaField';
import { SectionShell } from './_shared/SectionShell';
import { ThemeField } from './_shared/ThemeField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Hero section — above-the-fold lead. Phase 6 uplift: renders full-bleed
// through SectionShell at production fidelity, with three editable axes —
// `layout` (split image vs image overlay, cycled), `theme` (the editable
// colour theme), and `imageSide`. The headline is a two-line shape:
// `headline` + an accent-coloured `headlineAccent` line.
// =============================================================================

export type HeroLayout = 'split' | 'overlay';

export type HeroData = {
  /** Structural arrangement. */
  layout: HeroLayout;
  /** Editable colour theme. */
  theme: SectionTheme;
  /** Which side the image sits on in the `split` layout. */
  imageSide: 'left' | 'right';
  eyebrow: string;
  headline: string;
  /** Second headline line, rendered in the brand accent colour. */
  headlineAccent: string;
  sub: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  heroImageUrl: string;
};

const DEFAULTS: HeroData = {
  layout: 'split',
  theme: { background: '#0d1f3a', heading: '#ffffff', body: '#c4cdda' },
  imageSide: 'right',
  eyebrow: 'LOCAL · TRUSTED',
  headline: 'Power back on,',
  headlineAccent: 'guaranteed within the hour.',
  sub: 'Licensed sparkies covering Perth metro. Fixed callout, transparent quote — no surprises, ever.',
  ctaPrimaryLabel: 'Book a callout',
  ctaPrimaryHref: '/schedule',
  ctaSecondaryLabel: 'Call now',
  ctaSecondaryHref: 'tel:0400000000',
  heroImageUrl: '',
};

function defaultData(): HeroData {
  return { ...DEFAULTS, theme: { ...DEFAULTS.theme } };
}

/** Merge persisted data over defaults — covers sections saved before the
 *  Phase 6 uplift reshaped the hero (e.g. the old `surface` field). */
function withDefaults(data: HeroData): HeroData {
  return { ...DEFAULTS, ...data };
}

const HEADLINE_ALTS = [
  DEFAULTS.headline,
  'Local sparkies, on call.',
  'Same-day electrical work.',
] as const;

const HEADLINE_ACCENT_ALTS = [
  DEFAULTS.headlineAccent,
  'honest pricing, no surprises.',
  'quoted before we touch a wire.',
] as const;

const SUB_ALTS = [
  DEFAULTS.sub,
  'Vetted local sparkies. Same-day response. Twelve-month workmanship guarantee on every job.',
  'On-call electricians across Perth. We answer the phone, we quote on arrival, we stand behind the work.',
] as const;

const LAYOUT_OPTIONS: readonly VariantOption<HeroLayout>[] = [
  { id: 'split', label: 'Split image' },
  { id: 'overlay', label: 'Image overlay' },
];

const IMAGE_SIDE_OPTIONS: readonly VariantOption<'left' | 'right'>[] = [
  { id: 'left', label: 'Image left' },
  { id: 'right', label: 'Image right' },
];

// -- Fields -----------------------------------------------------------------

function HeroFields({ data, onChange }: SectionFieldsProps<HeroData>) {
  const d = withDefaults(data);
  const set = <K extends keyof HeroData>(key: K, value: HeroData[K]) =>
    onChange({ ...d, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <ThemeField value={d.theme} onChange={(v) => set('theme', v)} />
        <VariantField
          label="Layout"
          value={d.layout}
          options={LAYOUT_OPTIONS}
          onChange={(v) => set('layout', v)}
        />
        {d.layout === 'split' ? (
          <VariantField
            label="Image side"
            value={d.imageSide}
            options={IMAGE_SIDE_OPTIONS}
            onChange={(v) => set('imageSide', v)}
          />
        ) : null}
      </BuilderFormSection>
      <BuilderFormSection>
        <CopyField
          label="Eyebrow"
          value={d.eyebrow}
          originalValue={DEFAULTS.eyebrow}
          onChange={(v) => set('eyebrow', v)}
          placeholder="LOCAL · TRUSTED"
        />
        <CopyField
          label="Headline"
          value={d.headline}
          originalValue={DEFAULTS.headline}
          alternatives={HEADLINE_ALTS}
          onChange={(v) => set('headline', v)}
          multiline
          rows={2}
        />
        <CopyField
          label="Headline · accent line"
          value={d.headlineAccent}
          originalValue={DEFAULTS.headlineAccent}
          alternatives={HEADLINE_ACCENT_ALTS}
          onChange={(v) => set('headlineAccent', v)}
          multiline
          rows={2}
          helper={<>Rendered in the brand accent colour, on its own line.</>}
        />
        <CopyField
          label="Sub"
          value={d.sub}
          originalValue={DEFAULTS.sub}
          alternatives={SUB_ALTS}
          onChange={(v) => set('sub', v)}
          multiline
          rows={3}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <CopyField
            label="Primary CTA · label"
            value={d.ctaPrimaryLabel}
            originalValue={DEFAULTS.ctaPrimaryLabel}
            onChange={(v) => set('ctaPrimaryLabel', v)}
          />
          <CopyField
            label="Primary CTA · href"
            value={d.ctaPrimaryHref}
            originalValue={DEFAULTS.ctaPrimaryHref}
            onChange={(v) => set('ctaPrimaryHref', v)}
          />
        </BuilderFormRow>
        <BuilderFormRow>
          <CopyField
            label="Secondary CTA · label"
            value={d.ctaSecondaryLabel}
            originalValue={DEFAULTS.ctaSecondaryLabel}
            onChange={(v) => set('ctaSecondaryLabel', v)}
          />
          <CopyField
            label="Secondary CTA · href"
            value={d.ctaSecondaryHref}
            originalValue={DEFAULTS.ctaSecondaryHref}
            onChange={(v) => set('ctaSecondaryHref', v)}
          />
        </BuilderFormRow>
      </BuilderFormSection>
      <BuilderFormSection>
        <MediaField
          label="Hero image"
          value={d.heroImageUrl}
          onChange={(v) => set('heroImageUrl', v)}
        />
      </BuilderFormSection>
    </>
  );
}

// -- Preview ----------------------------------------------------------------

function HeroPreview({ data, brand }: SectionPreviewProps<HeroData>) {
  const d = withDefaults(data);
  const overlay = d.layout === 'overlay';

  return (
    <SectionShell
      theme={d.theme}
      brand={brand}
      inset="flush"
      pad="none"
      backgroundLayer={overlay ? <HeroBackground url={d.heroImageUrl} /> : undefined}
    >
      {({ theme, headingFont, accent }) => {
        // Overlay sits on a dark image scrim — force light text regardless
        // of the chosen theme (the theme only sets the no-image fallback).
        const heading = overlay ? '#ffffff' : theme.heading;
        const body = overlay ? 'rgba(255, 255, 255, 0.86)' : theme.body;

        const content = (
          <>
            {d.eyebrow ? (
              <p
                className="mb-4 text-[12px] font-bold uppercase tracking-[0.18em]"
                style={{ color: accent }}
              >
                {d.eyebrow}
              </p>
            ) : null}
            <h2
              className="text-[40px] font-bold leading-[1.06] tracking-[-0.02em] md:text-[52px]"
              style={{ fontFamily: headingFont, color: heading }}
            >
              <span className="block">{d.headline}</span>
              {d.headlineAccent ? (
                <span className="block" style={{ color: accent }}>
                  {d.headlineAccent}
                </span>
              ) : null}
            </h2>
            {d.sub ? (
              <p
                className="mt-5 max-w-[460px] text-[16px] leading-[1.6]"
                style={{ color: body }}
              >
                {d.sub}
              </p>
            ) : null}
            {d.ctaPrimaryLabel || d.ctaSecondaryLabel ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {d.ctaPrimaryLabel ? (
                  <span
                    className="inline-flex items-center rounded-lg px-6 py-3 text-[14px] font-semibold"
                    style={{ backgroundColor: accent, color: '#ffffff' }}
                  >
                    {d.ctaPrimaryLabel}
                  </span>
                ) : null}
                {d.ctaSecondaryLabel ? (
                  <span
                    className="inline-flex items-center rounded-lg border px-6 py-3 text-[14px] font-semibold"
                    style={{ borderColor: heading, color: heading }}
                  >
                    {d.ctaSecondaryLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        );

        if (overlay) {
          return (
            <div className="flex min-h-[480px] items-center px-8 py-20 md:px-16">
              <div className="max-w-[600px]">{content}</div>
            </div>
          );
        }

        const imageCell = (
          <HeroImage key="image" url={d.heroImageUrl} theme={theme} />
        );
        const contentCell = (
          <div
            key="content"
            className="flex flex-col justify-center px-8 py-14 md:px-12 md:py-16"
          >
            <div className="max-w-[520px]">{content}</div>
          </div>
        );

        return (
          <div className="grid min-h-[460px] md:grid-cols-2">
            {d.imageSide === 'left'
              ? [imageCell, contentCell]
              : [contentCell, imageCell]}
          </div>
        );
      }}
    </SectionShell>
  );
}

function HeroImage({ url, theme }: { url: string; theme: ResolvedTheme }) {
  return (
    <div
      className="relative min-h-[280px] w-full overflow-hidden md:min-h-full"
      style={{ backgroundColor: theme.card }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[12px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: theme.muted }}
          >
            Hero image
          </span>
        </div>
      )}
    </div>
  );
}

function HeroBackground({ url }: { url: string }) {
  return (
    <>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(100deg, rgba(8, 16, 32, 0.93) 0%, rgba(8, 16, 32, 0.7) 45%, rgba(8, 16, 32, 0.35) 100%)',
        }}
      />
    </>
  );
}

export const heroSection = defineSection<HeroData>({
  type: 'hero',
  label: '// HERO',
  description: 'Above-the-fold lead — eyebrow, two-line headline, sub, two CTAs, image.',
  defaultData,
  Fields: HeroFields,
  Preview: HeroPreview,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
      'headlineAccent',
      'sub',
      'ctaPrimaryLabel',
      'ctaPrimaryHref',
      'ctaSecondaryLabel',
      'ctaSecondaryHref',
    ],
    mediaFields: ['heroImageUrl'],
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
