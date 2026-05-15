'use client';

import { useCallback } from 'react';

import {
  BuilderField,
  BuilderFormRow,
  BuilderFormSection,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Button } from '@/components/ui/button';

import { defineSection, type SectionFieldsProps, type SectionPreviewProps } from '../registry';
import { CopyField } from './_shared/CopyField';

// =============================================================================
// Reviews section — review carousel. Wired manually in V1; auto-pulls from
// the Google Business Profile integration in V2 when GBP wiring lands.
// =============================================================================

export type ReviewItem = {
  id: string;
  author: string;
  rating: number;
  body: string;
  age: string;
};

export type ReviewsData = {
  title: string;
  intro: string;
  reviews: ReviewItem[];
};

function makeId(): string {
  return `rev-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULTS: ReviewsData = {
  title: 'What customers say',
  intro: 'Recent reviews from real jobs.',
  reviews: [
    {
      id: makeId(),
      author: 'Sam W.',
      rating: 5,
      body: 'On time, fixed the issue in 30 mins, told us how to avoid it again. No surprises on the invoice.',
      age: '2 weeks ago',
    },
    {
      id: makeId(),
      author: 'Priya R.',
      rating: 5,
      body: 'Came out after hours for a tripped circuit. Friendly, fast, fair price. Highly recommend.',
      age: '1 month ago',
    },
    {
      id: makeId(),
      author: 'David M.',
      rating: 5,
      body: 'Quoted in writing before any work. Stuck to the price. Cleaned up after the job. Will use again.',
      age: '2 months ago',
    },
  ],
};

function defaultData(): ReviewsData {
  return {
    ...DEFAULTS,
    reviews: DEFAULTS.reviews.map((r) => ({ ...r, id: makeId() })),
  };
}

const TITLE_ALTS = [
  'What customers say',
  'From real jobs',
  'Reviews from Perth homeowners',
] as const;

function ReviewsFields({ data, onChange }: SectionFieldsProps<ReviewsData>) {
  const setField = useCallback(
    <K extends keyof ReviewsData>(key: K, value: ReviewsData[K]) =>
      onChange({ ...data, [key]: value }),
    [data, onChange],
  );

  const setReview = useCallback(
    (index: number, next: ReviewItem) => {
      const reviews = data.reviews.slice();
      reviews[index] = next;
      onChange({ ...data, reviews });
    },
    [data, onChange],
  );

  const addReview = useCallback(() => {
    onChange({
      ...data,
      reviews: [
        ...data.reviews,
        { id: makeId(), author: '', rating: 5, body: '', age: '' },
      ],
    });
  }, [data, onChange]);

  const removeReview = useCallback(
    (id: string) => {
      onChange({ ...data, reviews: data.reviews.filter((r) => r.id !== id) });
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
          originalValue={DEFAULTS.intro}
          onChange={(v) => setField('intro', v)}
          multiline
          rows={2}
        />
      </BuilderFormSection>
      <BuilderFormSection>
        {data.reviews.map((review, i) => (
          <div
            key={review.id}
            className="mb-3.5 rounded-lg border border-rule bg-paper p-3.5 last:mb-0"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                Review {i + 1}
              </p>
              <CapabilityGate capability="editLayout" mode="hide">
                <button
                  type="button"
                  onClick={() => removeReview(review.id)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust hover:text-rust-deep"
                >
                  Remove ×
                </button>
              </CapabilityGate>
            </div>
            <BuilderFormRow>
              <CopyField
                label="Author"
                value={review.author}
                onChange={(v) => setReview(i, { ...review, author: v })}
              />
              <CopyField
                label="Age"
                value={review.age}
                onChange={(v) => setReview(i, { ...review, age: v })}
                placeholder="2 weeks ago"
              />
            </BuilderFormRow>
            <CopyField
              label="Body"
              value={review.body}
              onChange={(v) => setReview(i, { ...review, body: v })}
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
              onClick={addReview}
              className="w-full"
            >
              + Add review
            </Button>
          </BuilderField>
        </CapabilityGate>
      </BuilderFormSection>
    </>
  );
}

function ReviewsPreview({ data, brand }: SectionPreviewProps<ReviewsData>) {
  return (
    <section
      data-section-type="reviews"
      className="rounded-xl border border-rule bg-paper px-7 py-8 md:px-9"
    >
      <p
        className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: brand.accentColor }}
      >
        // REVIEWS
      </p>
      <h3 className="mb-2 text-[26px] font-extrabold leading-[1.12] tracking-[-0.015em] text-ink">
        {data.title}
      </h3>
      {data.intro ? (
        <p className="mb-5 max-w-[520px] text-[14px] leading-[1.55] text-ink-mid">
          {data.intro}
        </p>
      ) : null}
      {data.reviews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-rule bg-card px-4 py-6 text-center text-[12px] text-ink-quiet">
          No reviews yet.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-lg border border-rule bg-card px-4 py-3.5"
            >
              <p
                className="mb-2 font-mono text-[12px]"
                style={{ color: brand.accentColor }}
              >
                {'★'.repeat(Math.max(0, Math.min(5, review.rating || 0)))}
              </p>
              <p className="mb-2 text-[13px] leading-[1.5] text-ink">
                {review.body || 'No body'}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                {review.author || 'Anon'} · {review.age || '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const reviewsSection = defineSection<ReviewsData>({
  type: 'reviews',
  label: '// REVIEWS',
  description: 'Reviews carousel — author, rating, body, age. Manual in V1; auto-pulls from GBP later.',
  defaultData,
  Fields: ReviewsFields,
  Preview: ReviewsPreview,
  capabilityHints: {
    copyFields: ['title', 'intro', 'reviews'],
  },
  allowedContainers: ['page', 'funnelStep'],
  implemented: true,
});
