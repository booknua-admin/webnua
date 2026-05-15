'use client';

import { BuilderFormRow, BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// Offer section — single-offer card that anchors a funnel or service page.
// =============================================================================

export type OfferData = {
  tag: string;
  title: string;
  priceLabel: string;
  priceCaption: string;
  /** Newline-separated list of inclusions; parsed to rows at render time. */
  includedText: string;
  scarcityCopy: string;
  ctaLabel: string;
  ctaHref: string;
};

const DEFAULTS: OfferData = {
  tag: '// THE OFFER',
  title: 'Local sparkie, $99 callout, on-site in under 60 minutes.',
  priceLabel: '$99',
  priceCaption: 'Fixed call-out fee',
  includedText: [
    'No call-out surcharges, ever',
    'Same-day repair quote, written',
    'All work covered by our 12-month workmanship guarantee',
  ].join('\n'),
  scarcityCopy: 'Limited to 5 emergency slots per day.',
  ctaLabel: 'Book my callout',
  ctaHref: '/schedule',
};

function defaultData(): OfferData {
  return { ...DEFAULTS };
}

const TITLE_ALTS = [
  DEFAULTS.title,
  '$99 emergency callout — sparkie at your door inside the hour.',
  'Same-day electrical work. $99 callout. Written quote before we start.',
] as const;

const SCARCITY_ALTS = [
  DEFAULTS.scarcityCopy,
  'Only 5 emergency slots per day. Book now to lock yours in.',
  'After-hours slots fill fast — typically gone by 6pm on weekdays.',
] as const;

function parseIncluded(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function OfferFields({ data, onChange }: SectionFieldsProps<OfferData>) {
  const set = <K extends keyof OfferData>(key: K, value: OfferData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Tag"
          value={data.tag}
          originalValue={DEFAULTS.tag}
          onChange={(v) => set('tag', v)}
        />
        <CopyField
          label="Title"
          value={data.title}
          originalValue={DEFAULTS.title}
          alternatives={TITLE_ALTS}
          onChange={(v) => set('title', v)}
          multiline
          rows={2}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <CopyField
            label="Price · label"
            value={data.priceLabel}
            originalValue={DEFAULTS.priceLabel}
            onChange={(v) => set('priceLabel', v)}
            placeholder="$99"
          />
          <CopyField
            label="Price · caption"
            value={data.priceCaption}
            originalValue={DEFAULTS.priceCaption}
            onChange={(v) => set('priceCaption', v)}
            placeholder="Fixed call-out fee"
          />
        </BuilderFormRow>
        <CopyField
          label="Included"
          value={data.includedText}
          originalValue={DEFAULTS.includedText}
          onChange={(v) => set('includedText', v)}
          multiline
          rows={5}
          helper={<>One line per inclusion.</>}
        />
        <CopyField
          label="Scarcity copy"
          value={data.scarcityCopy}
          originalValue={DEFAULTS.scarcityCopy}
          alternatives={SCARCITY_ALTS}
          onChange={(v) => set('scarcityCopy', v)}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <CopyField
            label="CTA · label"
            value={data.ctaLabel}
            originalValue={DEFAULTS.ctaLabel}
            onChange={(v) => set('ctaLabel', v)}
          />
          <CopyField
            label="CTA · href"
            value={data.ctaHref}
            originalValue={DEFAULTS.ctaHref}
            onChange={(v) => set('ctaHref', v)}
          />
        </BuilderFormRow>
      </BuilderFormSection>
    </>
  );
}

function OfferPreview({ data, brand }: SectionPreviewProps<OfferData>) {
  const inclusions = parseIncluded(data.includedText);

  return (
    <section
      data-section-type="offer"
      className="rounded-xl border border-rule bg-card px-7 py-8 md:px-9"
    >
      <p
        className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: brand.accentColor }}
      >
        {data.tag}
      </p>
      <h3 className="mb-4 text-[24px] font-extrabold leading-[1.15] tracking-[-0.015em] text-ink">
        {data.title}
      </h3>
      <div className="mb-5 flex items-baseline gap-3">
        <span
          className="text-[40px] font-extrabold leading-none tracking-[-0.02em]"
          style={{ color: brand.accentColor }}
        >
          {data.priceLabel}
        </span>
        {data.priceCaption ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {data.priceCaption}
          </span>
        ) : null}
      </div>
      {inclusions.length > 0 ? (
        <ul className="mb-5 space-y-2">
          {inclusions.map((line, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-ink">
              <span
                aria-hidden
                className="mt-[3px] inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: brand.accentColor }}
              />
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {data.scarcityCopy ? (
        <p className="mb-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
          {data.scarcityCopy}
        </p>
      ) : null}
      {data.ctaLabel ? (
        <span
          className="inline-flex items-center rounded-[7px] px-[18px] py-2.5 text-[13px] font-bold text-paper"
          style={{ backgroundColor: brand.accentColor }}
        >
          {data.ctaLabel}
        </span>
      ) : null}
    </section>
  );
}

export const offerSection = defineSection<OfferData>({
  type: 'offer',
  label: '// OFFER',
  description: 'Single-offer card — tag, headline, price, inclusions, scarcity, CTA.',
  defaultData,
  Fields: OfferFields,
  Preview: OfferPreview,
  capabilityHints: {
    copyFields: [
      'tag',
      'title',
      'priceLabel',
      'priceCaption',
      'includedText',
      'scarcityCopy',
      'ctaLabel',
      'ctaHref',
    ],
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
