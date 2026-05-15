'use client';

import { BuilderFormRow, BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// CTA section — end-of-page final pitch block. Short headline + sub + button.
// =============================================================================

export type CTAData = {
  tag: string;
  headline: string;
  sub: string;
  ctaLabel: string;
  ctaHref: string;
};

const DEFAULTS: CTAData = {
  tag: '// READY?',
  headline: 'Sparkie at your door this hour.',
  sub: 'One call, fixed callout, written quote on arrival.',
  ctaLabel: 'Book a callout',
  ctaHref: '/schedule',
};

function defaultData(): CTAData {
  return { ...DEFAULTS };
}

const HEADLINE_ALTS = [
  'Sparkie at your door this hour.',
  'Need power back? Pick a time.',
  'Stop wasting today. Book a sparkie now.',
] as const;

const SUB_ALTS = [
  'One call, fixed callout, written quote on arrival.',
  'Same-day callouts, no surcharges, twelve-month guarantee.',
  'Real humans answering, real sparkies on the road, real receipts.',
] as const;

function CTAFields({ data, onChange }: SectionFieldsProps<CTAData>) {
  const set = <K extends keyof CTAData>(key: K, value: CTAData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Tag"
          value={data.tag}
          originalValue={DEFAULTS.tag}
          onChange={(v) => set('tag', v)}
          placeholder="// READY?"
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
          rows={2}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <CopyField
            label="Button · label"
            value={data.ctaLabel}
            originalValue={DEFAULTS.ctaLabel}
            onChange={(v) => set('ctaLabel', v)}
          />
          <CopyField
            label="Button · href"
            value={data.ctaHref}
            originalValue={DEFAULTS.ctaHref}
            onChange={(v) => set('ctaHref', v)}
          />
        </BuilderFormRow>
      </BuilderFormSection>
    </>
  );
}

function CTAPreview({ data, brand }: SectionPreviewProps<CTAData>) {
  return (
    <section
      data-section-type="cta"
      className="rounded-xl border border-rule bg-ink px-7 py-10 text-center text-paper md:px-9"
    >
      {data.tag ? (
        <p
          className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: brand.accentColor }}
        >
          {data.tag}
        </p>
      ) : null}
      <h3 className="mb-3 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-paper">
        {data.headline}
      </h3>
      {data.sub ? (
        <p className="mx-auto mb-5 max-w-[480px] text-[14px] leading-[1.55] text-paper/70">
          {data.sub}
        </p>
      ) : null}
      {data.ctaLabel ? (
        <span
          className="inline-flex items-center rounded-[7px] px-[22px] py-3 text-[14px] font-bold text-paper shadow-lg"
          style={{ backgroundColor: brand.accentColor }}
        >
          {data.ctaLabel}
        </span>
      ) : null}
    </section>
  );
}

export const ctaSection = defineSection<CTAData>({
  type: 'cta',
  label: '// CTA',
  description: 'End-of-page final-pitch block — short headline + sub + button.',
  defaultData,
  Fields: CTAFields,
  Preview: CTAPreview,
  capabilityHints: {
    copyFields: ['tag', 'headline', 'sub', 'ctaLabel', 'ctaHref'],
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
