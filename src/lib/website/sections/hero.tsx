'use client';

import {
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';
import { MediaField } from './_shared/MediaField';

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

const DEFAULTS: HeroData = {
  eyebrow: '// LOCAL · TRUSTED',
  headline: 'Power back on — guaranteed within the hour.',
  sub: 'Licensed sparkies covering Perth metro. Fixed callout, transparent quote, no surprises.',
  ctaPrimaryLabel: 'Book a callout',
  ctaPrimaryHref: '/schedule',
  ctaSecondaryLabel: 'Call now',
  ctaSecondaryHref: 'tel:0400000000',
  heroImageUrl: '',
};

function defaultData(): HeroData {
  return { ...DEFAULTS };
}

const HEADLINE_ALTS = [
  'Power back on — guaranteed within the hour.',
  'Local sparkies. Fast callouts. Honest pricing.',
  'Same-day electrical work, fixed quote before we touch a wire.',
] as const;

const SUB_ALTS = [
  'Licensed sparkies covering Perth metro. Fixed callout, transparent quote, no surprises.',
  'Vetted local sparkies. Same-day response. Twelve-month workmanship guarantee on every job.',
  'On-call electricians across Perth. We answer the phone. We quote on arrival. We stand behind the work.',
] as const;

function HeroFields({ data, onChange }: SectionFieldsProps<HeroData>) {
  const set = <K extends keyof HeroData>(key: K, value: HeroData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Eyebrow"
          value={data.eyebrow}
          originalValue={DEFAULTS.eyebrow}
          onChange={(v) => set('eyebrow', v)}
          placeholder="// LOCAL · TRUSTED"
        />
        <CopyField
          label="Headline"
          value={data.headline}
          originalValue={DEFAULTS.headline}
          alternatives={HEADLINE_ALTS}
          onChange={(v) => set('headline', v)}
          multiline
          rows={2}
        />
        <CopyField
          label="Sub"
          value={data.sub}
          originalValue={DEFAULTS.sub}
          alternatives={SUB_ALTS}
          onChange={(v) => set('sub', v)}
          multiline
          rows={3}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <CopyField
          label="Primary CTA · label"
          value={data.ctaPrimaryLabel}
          originalValue={DEFAULTS.ctaPrimaryLabel}
          onChange={(v) => set('ctaPrimaryLabel', v)}
        />
        <CopyField
          label="Primary CTA · href"
          value={data.ctaPrimaryHref}
          originalValue={DEFAULTS.ctaPrimaryHref}
          onChange={(v) => set('ctaPrimaryHref', v)}
        />
        <CopyField
          label="Secondary CTA · label"
          value={data.ctaSecondaryLabel}
          originalValue={DEFAULTS.ctaSecondaryLabel}
          onChange={(v) => set('ctaSecondaryLabel', v)}
        />
        <CopyField
          label="Secondary CTA · href"
          value={data.ctaSecondaryHref}
          originalValue={DEFAULTS.ctaSecondaryHref}
          onChange={(v) => set('ctaSecondaryHref', v)}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <MediaField
          label="Hero image URL"
          value={data.heroImageUrl}
          onChange={(v) => set('heroImageUrl', v)}
          helper="Paste a URL or leave blank for the placeholder."
        />
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
