'use client';

import { useCallback } from 'react';

import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
  BuilderInput,
  BuilderTextarea,
} from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';

// =============================================================================
// Offer section — the single-offer card that anchors a funnel. Used in the
// onboarding wizard's Step 3, but generalised here for reuse across pages.
// =============================================================================

export type OfferData = {
  tag: string;
  title: string;
  priceLabel: string;
  priceCaption: string;
  /** Newline-separated list of inclusions. Stored as a string for easy
   *  textarea editing; parsed to rows in the preview. */
  includedText: string;
  scarcityCopy: string;
  ctaLabel: string;
  ctaHref: string;
};

function defaultData(): OfferData {
  return {
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
}

function parseIncluded(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function OfferFields({ data, onChange }: SectionFieldsProps<OfferData>) {
  const set = useCallback(
    <K extends keyof OfferData>(key: K, value: OfferData[K]) =>
      onChange({ ...data, [key]: value }),
    [data, onChange],
  );

  return (
    <>
      <BuilderFormSection>
        <BuilderField label="Tag">
          <BuilderInput
            value={data.tag}
            onChange={(e) => set('tag', e.target.value)}
          />
        </BuilderField>
        <BuilderField label="Title">
          <BuilderTextarea
            rows={2}
            value={data.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </BuilderField>
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <BuilderField label="Price · label">
            <BuilderInput
              value={data.priceLabel}
              onChange={(e) => set('priceLabel', e.target.value)}
              placeholder="$99"
            />
          </BuilderField>
          <BuilderField label="Price · caption">
            <BuilderInput
              value={data.priceCaption}
              onChange={(e) => set('priceCaption', e.target.value)}
              placeholder="Fixed call-out fee"
            />
          </BuilderField>
        </BuilderFormRow>
        <BuilderField
          label="Included"
          helper={<>One line per inclusion. Lines starting with a hyphen are auto-cleaned.</>}
        >
          <BuilderTextarea
            rows={5}
            value={data.includedText}
            onChange={(e) => set('includedText', e.target.value)}
          />
        </BuilderField>
        <BuilderField label="Scarcity copy">
          <BuilderInput
            value={data.scarcityCopy}
            onChange={(e) => set('scarcityCopy', e.target.value)}
          />
        </BuilderField>
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <BuilderField label="CTA · label">
            <BuilderInput
              value={data.ctaLabel}
              onChange={(e) => set('ctaLabel', e.target.value)}
            />
          </BuilderField>
          <BuilderField label="CTA · href">
            <BuilderInput
              value={data.ctaHref}
              onChange={(e) => set('ctaHref', e.target.value)}
            />
          </BuilderField>
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
  implemented: true,
});
