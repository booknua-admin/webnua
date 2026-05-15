'use client';

import {
  BuilderField,
  BuilderFormSection,
  BuilderInput,
  BuilderTextarea,
} from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';

// =============================================================================
// Hero section — above-the-fold lead with eyebrow + headline + sub + CTAs +
// optional hero image. Most prominent section in any landing page.
// =============================================================================

export type HeroData = {
  eyebrow: string;
  headline: string;
  sub: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  heroImageUrl: string;
};

function defaultData(): HeroData {
  return {
    eyebrow: '// LOCAL · TRUSTED',
    headline: 'Power back on — guaranteed within the hour.',
    sub: 'Licensed sparkies covering Perth metro. Fixed callout, transparent quote, no surprises.',
    ctaPrimaryLabel: 'Book a callout',
    ctaPrimaryHref: '/schedule',
    ctaSecondaryLabel: 'Call now',
    ctaSecondaryHref: 'tel:0400000000',
    heroImageUrl: '',
  };
}

function HeroFields({ data, onChange }: SectionFieldsProps<HeroData>) {
  const set = <K extends keyof HeroData>(key: K, value: HeroData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <BuilderField label="Eyebrow">
          <BuilderInput
            value={data.eyebrow}
            onChange={(e) => set('eyebrow', e.target.value)}
            placeholder="// LOCAL · TRUSTED"
          />
        </BuilderField>
        <BuilderField label="Headline">
          <BuilderTextarea
            rows={2}
            value={data.headline}
            onChange={(e) => set('headline', e.target.value)}
          />
        </BuilderField>
        <BuilderField label="Sub">
          <BuilderTextarea
            rows={3}
            value={data.sub}
            onChange={(e) => set('sub', e.target.value)}
          />
        </BuilderField>
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderField label="Primary CTA · label">
          <BuilderInput
            value={data.ctaPrimaryLabel}
            onChange={(e) => set('ctaPrimaryLabel', e.target.value)}
          />
        </BuilderField>
        <BuilderField label="Primary CTA · href">
          <BuilderInput
            value={data.ctaPrimaryHref}
            onChange={(e) => set('ctaPrimaryHref', e.target.value)}
          />
        </BuilderField>
        <BuilderField label="Secondary CTA · label">
          <BuilderInput
            value={data.ctaSecondaryLabel}
            onChange={(e) => set('ctaSecondaryLabel', e.target.value)}
          />
        </BuilderField>
        <BuilderField label="Secondary CTA · href">
          <BuilderInput
            value={data.ctaSecondaryHref}
            onChange={(e) => set('ctaSecondaryHref', e.target.value)}
          />
        </BuilderField>
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderField
          label="Hero image URL"
          helper="Paste a URL or leave blank for the placeholder."
        >
          <BuilderInput
            value={data.heroImageUrl}
            onChange={(e) => set('heroImageUrl', e.target.value)}
            placeholder="https://..."
          />
        </BuilderField>
      </BuilderFormSection>
    </>
  );
}

function HeroPreview({ data, brand }: SectionPreviewProps<HeroData>) {
  return (
    <section
      data-section-type="hero"
      className="grid gap-7 rounded-xl border border-rule bg-paper px-7 py-9 md:grid-cols-[1.2fr_1fr] md:px-9"
    >
      <div className="flex flex-col justify-center">
        <p
          className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: brand.accentColor }}
        >
          {data.eyebrow}
        </p>
        <h2 className="mb-3 text-[34px] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
          {data.headline}
        </h2>
        <p className="mb-5 max-w-[440px] text-[15px] leading-[1.55] text-ink-mid">
          {data.sub}
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {data.ctaPrimaryLabel ? (
            <span
              className="inline-flex items-center rounded-[7px] px-[18px] py-2.5 text-[13px] font-bold text-paper"
              style={{ backgroundColor: brand.accentColor }}
            >
              {data.ctaPrimaryLabel}
            </span>
          ) : null}
          {data.ctaSecondaryLabel ? (
            <span className="inline-flex items-center rounded-[7px] border border-rule px-[18px] py-2.5 text-[13px] font-bold text-ink">
              {data.ctaSecondaryLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div
        aria-hidden
        className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-lg border border-rule bg-paper-2"
      >
        {data.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.heroImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <p className="px-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-quiet">
            Hero image
            <br />
            placeholder
          </p>
        )}
      </div>
    </section>
  );
}

export const heroSection = defineSection<HeroData>({
  type: 'hero',
  label: '// HERO',
  description: 'Above-the-fold lead — eyebrow, headline, sub, two CTAs, hero image.',
  defaultData,
  Fields: HeroFields,
  Preview: HeroPreview,
  capabilityHints: {
    copyFields: [
      'eyebrow',
      'headline',
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
