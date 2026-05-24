'use client';

// =============================================================================
// Step 3: Target customer + offer. Skippable.
//
// Drives THREE generation inputs:
//   - audienceLine (BrandObject.audienceLine) ← targetCustomer
//   - funnel.customerPain (derived) ← targetCustomer
//   - funnel.guarantee + business.offer ← usp + startingPriceFraming
//
// "Average job value" is captured as free text — operators give us
// "$200–$600" / "from €99" / "varies", and the generator handles it
// without parsing.
// =============================================================================

import { useState } from 'react';

import type { Step3Data } from '@/lib/onboarding/types';

import { StepFrame } from './_step-frame';

type Step3Props = {
  initial: Step3Data | null;
  onContinue: (data: Step3Data) => void;
  onSkip: () => void;
  onBack: () => void;
};

const AUDIENCE_CHIPS = [
  'Homeowners',
  'Property managers',
  'Small businesses',
  'Builders',
  'Real-estate agents',
] as const;

export function Step3Target({ initial, onContinue, onSkip, onBack }: Step3Props) {
  const [targetCustomer, setTargetCustomer] = useState(initial?.targetCustomer ?? '');
  const [averageJobValue, setAverageJobValue] = useState(initial?.averageJobValue ?? '');
  const [startingPriceFraming, setStartingPriceFraming] = useState(
    initial?.startingPriceFraming ?? '',
  );
  const [usp, setUsp] = useState(initial?.usp ?? '');

  function pickAudience(value: string) {
    setTargetCustomer((prev) => (prev === value ? '' : value));
  }

  function handleContinue() {
    onContinue({
      targetCustomer: targetCustomer.trim(),
      averageJobValue: averageJobValue.trim(),
      startingPriceFraming: startingPriceFraming.trim(),
      usp: usp.trim(),
    });
  }

  return (
    <StepFrame
      title={
        <>
          Who do you <em>serve</em>?
        </>
      }
      description={
        <>
          Pick or type the customer you want more of. The funnel speaks
          directly to them. <strong>Skip if you want the default mixed-audience copy.</strong>
        </>
      }
      onContinue={handleContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
            Target customer
          </label>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {AUDIENCE_CHIPS.map((chip) => {
              const isOn = targetCustomer === chip;
              return (
                <button
                  type="button"
                  key={chip}
                  onClick={() => pickAudience(chip)}
                  className={
                    'rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ' +
                    (isOn
                      ? 'border-rust bg-rust text-paper'
                      : 'border-rule bg-card text-ink-soft hover:border-ink')
                  }
                >
                  {chip}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={targetCustomer}
            onChange={(e) => setTargetCustomer(e.target.value)}
            placeholder="Or type your own — e.g. 'Older homeowners west of the city'"
            className="block w-full rounded-lg border border-rule bg-card px-4 py-3 text-[15px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2] md:text-[14px]"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field
            label="Average job value"
            sub="Free text — anything from a range to 'varies'."
            value={averageJobValue}
            onChange={setAverageJobValue}
            placeholder="e.g. $200–$600 / from €99 / varies"
          />
          <Field
            label="Starting price (optional)"
            sub="Surfaces in the offer headline when set."
            value={startingPriceFraming}
            onChange={setStartingPriceFraming}
            placeholder="e.g. from €99"
          />
        </div>

        <Field
          label="What makes you different? (optional)"
          sub="Becomes the funnel's guarantee + a hero accent."
          value={usp}
          onChange={setUsp}
          placeholder="e.g. Same-day callout. Fixed-price quote BEFORE we start. 12-month warranty."
          multiline
        />
      </div>
    </StepFrame>
  );
}

function Field({
  label,
  sub,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  sub?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="block w-full rounded-lg border border-rule bg-card px-4 py-3 text-[15px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2] md:text-[14px]"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-lg border border-rule bg-card px-4 py-3 text-[15px] text-ink focus:border-rust focus:outline-none focus:ring-2 focus:ring-rust/[0.2] md:text-[14px]"
        />
      )}
      {sub ? <p className="mt-1.5 text-[12px] leading-[1.4] text-ink-quiet">{sub}</p> : null}
    </div>
  );
}
