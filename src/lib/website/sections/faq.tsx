'use client';

import { useCallback } from 'react';

import { BuilderField, BuilderFormSection } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// FAQ section — list of question/answer pairs. Real "accordion" toggle UX
// renders on the live site; preview shows them all open at once for editor
// scannability.
// =============================================================================

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export type FAQData = {
  title: string;
  intro: string;
  items: FAQItem[];
};

function makeId(): string {
  return `faq-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULTS: FAQData = {
  title: 'Common questions',
  intro: '',
  items: [
    {
      id: makeId(),
      question: 'How fast can you get here?',
      answer: 'Most weekday callouts inside the hour. After hours, typically 90 mins.',
    },
    {
      id: makeId(),
      question: 'Is the $99 callout the total price?',
      answer: 'No — the $99 is the fixed callout fee. Repairs are quoted in writing before any work starts.',
    },
    {
      id: makeId(),
      question: 'What areas do you cover?',
      answer: 'All Perth metro. North, south, east, hills — same callout fee, same response time.',
    },
  ],
};

function defaultData(): FAQData {
  return {
    ...DEFAULTS,
    items: DEFAULTS.items.map((i) => ({ ...i, id: makeId() })),
  };
}

const TITLE_ALTS = [
  'Common questions',
  'FAQ',
  'Before you book — quick answers',
] as const;

function FAQFields({ data, onChange }: SectionFieldsProps<FAQData>) {
  const setField = useCallback(
    <K extends keyof FAQData>(key: K, value: FAQData[K]) =>
      onChange({ ...data, [key]: value }),
    [data, onChange],
  );

  const setItem = useCallback(
    (index: number, next: FAQItem) => {
      const items = data.items.slice();
      items[index] = next;
      onChange({ ...data, items });
    },
    [data, onChange],
  );

  const addItem = useCallback(() => {
    onChange({
      ...data,
      items: [...data.items, { id: makeId(), question: '', answer: '' }],
    });
  }, [data, onChange]);

  const removeItem = useCallback(
    (id: string) => {
      onChange({ ...data, items: data.items.filter((i) => i.id !== id) });
    },
    [data, onChange],
  );

  return (
    <>
      <BuilderFormSection>
        <CopyField
          label="Section title"
          value={data.title}
          originalValue={DEFAULTS.title}
          alternatives={TITLE_ALTS}
          onChange={(v) => setField('title', v)}
        />
        <CopyField
          label="Intro"
          value={data.intro}
          onChange={(v) => setField('intro', v)}
          multiline
          rows={2}
          helper="Optional — left blank in the default."
        />
      </BuilderFormSection>
      <BuilderFormSection>
        {data.items.map((item, i) => (
          <div
            key={item.id}
            className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Q · {i + 1}
              </p>
              <CapabilityGate capability="editLayout" mode="hide">
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                >
                  Remove ×
                </button>
              </CapabilityGate>
            </div>
            <CopyField
              label="Question"
              value={item.question}
              onChange={(v) => setItem(i, { ...item, question: v })}
            />
            <CopyField
              label="Answer"
              value={item.answer}
              onChange={(v) => setItem(i, { ...item, answer: v })}
              multiline
              rows={3}
            />
          </div>
        ))}
        <CapabilityGate capability="editLayout" mode="disable">
          <BuilderField label="">
            <Button
              variant="secondary"
              size="sm"
              onClick={addItem}
              className="w-full"
            >
              + Add question
            </Button>
          </BuilderField>
        </CapabilityGate>
      </BuilderFormSection>
    </>
  );
}

function FAQPreview({ data, brand }: SectionPreviewProps<FAQData>) {
  return (
    <section
      data-section-type="faq"
      className="rounded-xl border border-rule bg-paper px-7 py-8 md:px-9"
    >
      <p
        className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: brand.accentColor }}
      >
        // FAQ
      </p>
      <h3 className="mb-2 text-[26px] font-extrabold leading-[1.12] tracking-[-0.015em] text-ink">
        {data.title}
      </h3>
      {data.intro ? (
        <p className="mb-5 max-w-[520px] text-[14px] leading-[1.55] text-ink-mid">
          {data.intro}
        </p>
      ) : null}
      {data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rule bg-card px-4 py-6 text-center text-[12px] text-ink-quiet">
          No questions yet.
        </p>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-card">
          {data.items.map((item) => (
            <li key={item.id} className="px-4 py-3.5">
              <p className="mb-1 text-[14px] font-bold text-ink">
                {item.question || 'Untitled question'}
              </p>
              <p className="text-[13px] leading-[1.5] text-ink-mid">
                {item.answer || '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const faqSection = defineSection<FAQData>({
  type: 'faq',
  label: '// FAQ',
  description: 'Common-questions list — question + answer pairs.',
  defaultData,
  Fields: FAQFields,
  Preview: FAQPreview,
  capabilityHints: {
    copyFields: ['title', 'intro', 'items'],
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
