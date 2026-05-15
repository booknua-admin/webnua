'use client';

import { BuilderFormRow, BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// Trust section — row of trust signals (rating, years in business, licence,
// guarantee). Stackable on pages and funnel steps.
// =============================================================================

export type TrustData = {
  intro: string;
  ratingValue: string;     // "4.9"
  ratingMax: string;       // "5.0"
  ratingSource: string;    // "Google · 174 reviews"
  yearsLabel: string;      // "8 yrs in business"
  licenceLabel: string;    // "Lic #12345"
  guaranteeLabel: string;  // "12-mo workmanship guarantee"
};

const DEFAULTS: TrustData = {
  intro: '// TRUSTED',
  ratingValue: '4.9',
  ratingMax: '5',
  ratingSource: 'Google · 174 reviews',
  yearsLabel: '8 years in Perth',
  licenceLabel: 'Lic #EC-12345',
  guaranteeLabel: '12-mo workmanship guarantee',
};

function defaultData(): TrustData {
  return { ...DEFAULTS };
}

function TrustFields({ data, onChange }: SectionFieldsProps<TrustData>) {
  const set = <K extends keyof TrustData>(key: K, value: TrustData[K]) =>
    onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Eyebrow"
          value={data.intro}
          originalValue={DEFAULTS.intro}
          onChange={(v) => set('intro', v)}
          placeholder="// TRUSTED"
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <BuilderFormRow>
          <CopyField
            label="Rating value"
            value={data.ratingValue}
            originalValue={DEFAULTS.ratingValue}
            onChange={(v) => set('ratingValue', v)}
            placeholder="4.9"
          />
          <CopyField
            label="Rating max"
            value={data.ratingMax}
            originalValue={DEFAULTS.ratingMax}
            onChange={(v) => set('ratingMax', v)}
            placeholder="5"
          />
        </BuilderFormRow>
        <CopyField
          label="Rating source"
          value={data.ratingSource}
          originalValue={DEFAULTS.ratingSource}
          onChange={(v) => set('ratingSource', v)}
          placeholder="Google · 174 reviews"
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <CopyField
          label="Years in business"
          value={data.yearsLabel}
          originalValue={DEFAULTS.yearsLabel}
          onChange={(v) => set('yearsLabel', v)}
        />
        <CopyField
          label="Licence"
          value={data.licenceLabel}
          originalValue={DEFAULTS.licenceLabel}
          onChange={(v) => set('licenceLabel', v)}
        />
        <CopyField
          label="Guarantee"
          value={data.guaranteeLabel}
          originalValue={DEFAULTS.guaranteeLabel}
          onChange={(v) => set('guaranteeLabel', v)}
        />
      </BuilderFormSection>
    </>
  );
}

function TrustPreview({ data, brand }: SectionPreviewProps<TrustData>) {
  const pills: { label: string; sub?: string }[] = [];
  if (data.ratingValue) {
    pills.push({
      label: `★ ${data.ratingValue}/${data.ratingMax}`,
      sub: data.ratingSource,
    });
  }
  if (data.yearsLabel) pills.push({ label: data.yearsLabel });
  if (data.licenceLabel) pills.push({ label: data.licenceLabel });
  if (data.guaranteeLabel) pills.push({ label: data.guaranteeLabel });

  return (
    <section
      data-section-type="trust"
      className="rounded-xl border border-rule bg-paper px-7 py-6 md:px-9"
    >
      {data.intro ? (
        <p
          className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: brand.accentColor }}
        >
          {data.intro}
        </p>
      ) : null}
      <div className="flex flex-wrap items-stretch gap-2">
        {pills.length === 0 ? (
          <p className="text-[13px] text-ink-quiet">No trust signals set.</p>
        ) : (
          pills.map((pill, i) => (
            <div
              key={i}
              className="flex flex-col rounded-lg border border-rule bg-card px-3.5 py-2.5"
            >
              <p
                className="text-[14px] font-bold text-ink"
                style={i === 0 && pill.label.startsWith('★') ? { color: brand.accentColor } : undefined}
              >
                {pill.label}
              </p>
              {pill.sub ? (
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                  {pill.sub}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export const trustSection = defineSection<TrustData>({
  type: 'trust',
  label: '// TRUST',
  description: 'Row of trust signals — rating, years in business, licence, guarantee.',
  defaultData,
  Fields: TrustFields,
  Preview: TrustPreview,
  capabilityHints: {
    copyFields: [
      'intro',
      'ratingValue',
      'ratingMax',
      'ratingSource',
      'yearsLabel',
      'licenceLabel',
      'guaranteeLabel',
    ],
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
