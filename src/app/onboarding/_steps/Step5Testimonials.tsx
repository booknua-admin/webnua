'use client';

// =============================================================================
// Step 5: Testimonials. Skippable.
//
// 0–3 entries. Empty array → the funnel renders the "Your customer reviews
// will appear here" placeholder (per CLAUDE.md — we NEVER invent quotes;
// the rule survived from the funnel-testimonials parked decision).
//
// The wizard's social-proof story is honest: a customer with real reviews
// sees them in their hero, a customer without sees a placeholder + the
// rest of the trust signals from step 1.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Step5Data, Step5Testimonial } from '@/lib/onboarding/types';

import { StepFrame } from './_step-frame';

const MAX_TESTIMONIALS = 3;

type Step5Props = {
  initial: Step5Data | null;
  onContinue: (data: Step5Data) => void;
  onSkip: () => void;
  onBack: () => void;
};

export function Step5Testimonials({ initial, onContinue, onSkip, onBack }: Step5Props) {
  const [items, setItems] = useState<Step5Testimonial[]>(initial?.testimonials ?? []);

  function add() {
    if (items.length >= MAX_TESTIMONIALS) return;
    setItems((prev) => [...prev, { quote: '', author: '', context: '' }]);
  }
  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function update(index: number, patch: Partial<Step5Testimonial>) {
    setItems((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function handleContinue() {
    // Drop empty rows so the funnel doesn't render a quote without text.
    const filtered = items.filter(
      (t) => t.quote.trim() && t.author.trim(),
    );
    onContinue({ testimonials: filtered });
  }

  return (
    <StepFrame
      title={
        <>
          A few <em>real</em> reviews?
        </>
      }
      description={
        <>
          Add 1–3 quotes from happy customers. We&rsquo;ll feature them on
          your funnel.{' '}
          <strong>
            Skip if you don&rsquo;t have any yet — we&rsquo;ll show a clean
            placeholder until your first Google review lands.
          </strong>
        </>
      }
      onContinue={handleContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-4">
        {items.map((t, i) => (
          <div
            key={i}
            className="rounded-xl border border-rule bg-card px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                {`// Testimonial ${i + 1}`}
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-warn"
              >
                Remove
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <textarea
                value={t.quote}
                onChange={(e) => update(i, { quote: e.target.value })}
                rows={3}
                placeholder="What the customer said…"
                className="block w-full rounded-lg border border-rule bg-paper px-4 py-3 text-[14px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2]"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.4fr]">
                <input
                  type="text"
                  value={t.author}
                  onChange={(e) => update(i, { author: e.target.value })}
                  placeholder="Author (e.g. Jamie K.)"
                  className="block w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-[14px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2]"
                />
                <input
                  type="text"
                  value={t.context}
                  onChange={(e) => update(i, { context: e.target.value })}
                  placeholder="Context (optional) — e.g. Bondi, boiler install"
                  className="block w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-[14px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2]"
                />
              </div>
            </div>
          </div>
        ))}

        {items.length < MAX_TESTIMONIALS ? (
          <Button type="button" variant="outline" onClick={add} className="self-start">
            + Add testimonial
          </Button>
        ) : (
          <p className="text-[12.5px] text-ink-quiet">
            That&rsquo;s 3 testimonials — the max. You can add more from the
            site editor after publishing.
          </p>
        )}

        <p className="rounded-lg border border-dashed border-rule bg-paper-2 px-4 py-3 text-[12.5px] leading-[1.5] text-ink-quiet">
          <strong className="text-ink">Why we&rsquo;re strict here:</strong>{' '}
          Webnua never invents quotes. If you don&rsquo;t have testimonials
          yet, we&rsquo;ll show a clean placeholder until your first real
          Google review comes in — which usually happens within your first
          few jobs once your Google Business Profile is connected.
        </p>
      </div>
    </StepFrame>
  );
}
