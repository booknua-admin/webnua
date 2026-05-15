'use client';

import { BuilderFormRow, BuilderFormSection } from '@/components/shared/builder/BuilderField';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// Thanks confirmation section — funnel-only. Confirms a booking + optional
// referral CTA. Renders only on funnel thanks-step pages.
// =============================================================================

export type ThanksConfirmationData = {
  title: string;
  body: string;
  detailLine: string;
  referralTitle: string;
  referralBody: string;
  referralCtaLabel: string;
  referralCtaHref: string;
};

const DEFAULTS: ThanksConfirmationData = {
  title: "You're booked.",
  body: "We'll SMS to confirm within 10 minutes.",
  detailLine: 'Look for a text from a Perth number — that\'s us.',
  referralTitle: 'Know someone who needs a sparkie?',
  referralBody: 'Refer a friend — they get $25 off their first callout, you get $25 credit on your next.',
  referralCtaLabel: 'Send a referral',
  referralCtaHref: '/refer',
};

function defaultData(): ThanksConfirmationData {
  return { ...DEFAULTS };
}

const TITLE_ALTS = [
  "You're booked.",
  'Booking confirmed.',
  'Sorted. We\'ll see you soon.',
] as const;

function ThanksConfirmationFields({
  data,
  onChange,
}: SectionFieldsProps<ThanksConfirmationData>) {
  const set = <K extends keyof ThanksConfirmationData>(
    key: K,
    value: ThanksConfirmationData[K],
  ) => onChange({ ...data, [key]: value });

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Title"
          value={data.title}
          originalValue={DEFAULTS.title}
          alternatives={TITLE_ALTS}
          onChange={(v) => set('title', v)}
        />
        <CopyField
          label="Body"
          value={data.body}
          originalValue={DEFAULTS.body}
          onChange={(v) => set('body', v)}
          multiline
          rows={2}
        />
        <CopyField
          label="Detail line"
          value={data.detailLine}
          originalValue={DEFAULTS.detailLine}
          onChange={(v) => set('detailLine', v)}
          helper="Smaller paragraph shown under the body."
        />
      </BuilderFormSection>
      <BuilderFormSection>
        <CopyField
          label="Referral title"
          value={data.referralTitle}
          originalValue={DEFAULTS.referralTitle}
          onChange={(v) => set('referralTitle', v)}
          helper="Leave blank to hide the referral block."
        />
        <CopyField
          label="Referral body"
          value={data.referralBody}
          originalValue={DEFAULTS.referralBody}
          onChange={(v) => set('referralBody', v)}
          multiline
          rows={2}
        />
        <BuilderFormRow>
          <CopyField
            label="Referral · label"
            value={data.referralCtaLabel}
            originalValue={DEFAULTS.referralCtaLabel}
            onChange={(v) => set('referralCtaLabel', v)}
          />
          <CopyField
            label="Referral · href"
            value={data.referralCtaHref}
            originalValue={DEFAULTS.referralCtaHref}
            onChange={(v) => set('referralCtaHref', v)}
          />
        </BuilderFormRow>
      </BuilderFormSection>
    </>
  );
}

function ThanksConfirmationPreview({
  data,
  brand,
}: SectionPreviewProps<ThanksConfirmationData>) {
  return (
    <section
      data-section-type="thanksConfirmation"
      className="rounded-xl border border-rule bg-paper px-7 py-9 md:px-9"
    >
      <div className="mb-7 text-center">
        <div
          aria-hidden
          className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-[24px] font-extrabold text-paper"
          style={{ backgroundColor: brand.accentColor }}
        >
          ✓
        </div>
        <h3 className="mb-2 text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
          {data.title}
        </h3>
        {data.body ? (
          <p className="mx-auto max-w-[480px] text-[14px] leading-[1.55] text-ink-mid">
            {data.body}
          </p>
        ) : null}
        {data.detailLine ? (
          <p className="mx-auto mt-2 max-w-[480px] font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {data.detailLine}
          </p>
        ) : null}
      </div>
      {data.referralTitle ? (
        <div className="rounded-lg border border-rule bg-card px-5 py-5 text-center">
          <p
            className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: brand.accentColor }}
          >
            // REFER + EARN
          </p>
          <p className="mb-1 text-[16px] font-bold text-ink">
            {data.referralTitle}
          </p>
          {data.referralBody ? (
            <p className="mx-auto mb-3 max-w-[420px] text-[13px] leading-[1.5] text-ink-mid">
              {data.referralBody}
            </p>
          ) : null}
          {data.referralCtaLabel ? (
            <span
              className="inline-flex items-center rounded-[7px] px-4 py-2 text-[12px] font-bold text-paper"
              style={{ backgroundColor: brand.accentColor }}
            >
              {data.referralCtaLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export const thanksConfirmationSection = defineSection<ThanksConfirmationData>({
  type: 'thanksConfirmation',
  label: '// THANKS',
  description: 'Funnel thanks-step confirmation + optional referral block.',
  defaultData,
  Fields: ThanksConfirmationFields,
  Preview: ThanksConfirmationPreview,
  capabilityHints: {
    copyFields: [
      'title',
      'body',
      'detailLine',
      'referralTitle',
      'referralBody',
      'referralCtaLabel',
      'referralCtaHref',
    ],
  },
  allowedContainers: ['funnelStep'],
  implemented: true,
});
