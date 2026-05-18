'use client';

import { BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import type { SectionTheme } from '../section-theme';
import { CopyField } from './_shared/CopyField';
import { MediaField } from './_shared/MediaField';
import { SectionShell } from './_shared/SectionShell';
import { SelectableElement } from './_shared/SelectableElement';
import { ColorField, ThemePresetField } from './_shared/ThemeField';
import { VariantField, type VariantOption } from './_shared/VariantField';

// =============================================================================
// Hero section — above-the-fold lead. Phase 6 element-inspector model: the
// preview's regions (eyebrow / headline / sub / CTAs) are individually
// selectable; the Fields panel shows only the selected element's settings.
// With no element selected it shows section-level settings (theme preset,
// background colour, layout, image).
// =============================================================================

export type HeroLayout = 'split' | 'overlay';

/** Selectable element ids within the hero preview. */
type HeroElement = 'eyebrow' | 'headline' | 'subheadline' | 'ctaPrimary' | 'ctaSecondary';

export type HeroData = {
  layout: HeroLayout;
  theme: SectionTheme;
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
 *  Phase 6 uplift reshaped the hero. */
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

function HeroFields({ data, onChange, selectedElement }: SectionFieldsProps<HeroData>) {
  const d = withDefaults(data);
  const set = <K extends keyof HeroData>(key: K, value: HeroData[K]) =>
    onChange({ ...d, [key]: value });
  const setColor = (key: keyof SectionTheme, value: string) =>
    set('theme', { ...d.theme, [key]: value });

  // -- element panels --
  if (selectedElement === 'eyebrow') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Eyebrow"
          value={d.eyebrow}
          originalValue={DEFAULTS.eyebrow}
          onChange={(v) => set('eyebrow', v)}
          placeholder="LOCAL · TRUSTED"
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'headline') {
    return (
      <BuilderFormSection>
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
          label="Accent line"
          value={d.headlineAccent}
          originalValue={DEFAULTS.headlineAccent}
          alternatives={HEADLINE_ACCENT_ALTS}
          onChange={(v) => set('headlineAccent', v)}
          multiline
          rows={2}
          helper={<>Second line — rendered in the brand accent colour.</>}
        />
        <ColorField
          label="Heading colour"
          value={d.theme.heading}
          onChange={(v) => setColor('heading', v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'subheadline') {
    return (
      <BuilderFormSection>
        <CopyField
          label="Sub-headline"
          value={d.sub}
          originalValue={DEFAULTS.sub}
          alternatives={SUB_ALTS}
          onChange={(v) => set('sub', v)}
          multiline
          rows={3}
        />
        <ColorField
          label="Text colour"
          value={d.theme.body}
          onChange={(v) => setColor('body', v)}
        />
      </BuilderFormSection>
    );
  }

  if (selectedElement === 'ctaPrimary' || selectedElement === 'ctaSecondary') {
    const isPrimary = selectedElement === 'ctaPrimary';
    const labelKey = isPrimary ? 'ctaPrimaryLabel' : 'ctaSecondaryLabel';
    const hrefKey = isPrimary ? 'ctaPrimaryHref' : 'ctaSecondaryHref';
    return (
      <BuilderFormSection>
        <CopyField
          label={isPrimary ? 'Primary button · label' : 'Secondary button · label'}
          value={d[labelKey]}
          originalValue={DEFAULTS[labelKey]}
          onChange={(v) => set(labelKey, v)}
        />
        <CopyField
          label="Link"
          value={d[hrefKey]}
          originalValue={DEFAULTS[hrefKey]}
          onChange={(v) => set(hrefKey, v)}
        />
      </BuilderFormSection>
    );
  }

  // -- section-level settings (no element selected) --
  return (
    <>
      <BuilderFormSection>
        <ThemePresetField value={d.theme} onChange={(v) => set('theme', v)} />
        <ColorField
          label="Background"
          value={d.theme.background}
          onChange={(v) => setColor('background', v)}
        />
      </BuilderFormSection>
      <BuilderFormSection>
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

function HeroPreview({
  data,
  brand,
  selectedElement,
  onSelectElement,
}: SectionPreviewProps<HeroData>) {
  const d = withDefaults(data);
  const overlay = d.layout === 'overlay';

  return (
    <SectionShell
      theme={d.theme}
      brand={brand}
      inset="flush"
      pad="none"
      backgroundLayer={
        overlay ? (
          <HeroBackground url={d.heroImageUrl} scrim={d.theme.background} />
        ) : undefined
      }
    >
      {({ theme, headingFont, accent }) => {
        const sel = (id: HeroElement) => ({
          id,
          selected: selectedElement === id,
          onSelect: onSelectElement,
        });

        const content = (
          <>
            {d.eyebrow ? (
              <SelectableElement {...sel('eyebrow')}>
                <p
                  className="text-[12px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: accent }}
                >
                  {d.eyebrow}
                </p>
              </SelectableElement>
            ) : null}
            <SelectableElement {...sel('headline')} className="mt-4">
              <h2
                className="text-[40px] font-bold leading-[1.06] tracking-[-0.02em] md:text-[52px]"
                style={{ fontFamily: headingFont, color: theme.heading }}
              >
                <span className="block">{d.headline}</span>
                {d.headlineAccent ? (
                  <span className="block" style={{ color: accent }}>
                    {d.headlineAccent}
                  </span>
                ) : null}
              </h2>
            </SelectableElement>
            {d.sub ? (
              <SelectableElement {...sel('subheadline')} className="mt-5">
                <p
                  className="max-w-[460px] text-[16px] leading-[1.6]"
                  style={{ color: theme.body }}
                >
                  {d.sub}
                </p>
              </SelectableElement>
            ) : null}
            {d.ctaPrimaryLabel || d.ctaSecondaryLabel ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {d.ctaPrimaryLabel ? (
                  <SelectableElement {...sel('ctaPrimary')} display="inline-block">
                    <span
                      className="inline-flex items-center rounded-lg px-6 py-3 text-[14px] font-semibold"
                      style={{ backgroundColor: accent, color: '#ffffff' }}
                    >
                      {d.ctaPrimaryLabel}
                    </span>
                  </SelectableElement>
                ) : null}
                {d.ctaSecondaryLabel ? (
                  <SelectableElement {...sel('ctaSecondary')} display="inline-block">
                    <span
                      className="inline-flex items-center rounded-lg border px-6 py-3 text-[14px] font-semibold"
                      style={{ borderColor: theme.heading, color: theme.heading }}
                    >
                      {d.ctaSecondaryLabel}
                    </span>
                  </SelectableElement>
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

function HeroImage({
  url,
  theme,
}: {
  url: string;
  theme: { card: string; muted: string };
}) {
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

function HeroBackground({ url, scrim }: { url: string; scrim: string }) {
  return (
    <>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(100deg, ${scrim} 0%, ${scrim}f0 38%, ${scrim}73 100%)`,
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
  elementLabels: {
    eyebrow: 'Eyebrow',
    headline: 'Headline',
    subheadline: 'Sub-headline',
    ctaPrimary: 'Primary button',
    ctaSecondary: 'Secondary button',
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
