'use client';

// =============================================================================
// _step-frame — shared step header + footer chrome.
//
// Each step renders a StepFrame wrapping its body. The frame provides the
// title + description + skip-allowed-or-not + Back / Skip / Continue
// actions in a mobile-friendly layout (stacked below md, side-by-side
// above). Per-step bodies stay focused on their own inputs.
// =============================================================================

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

export type StepFrameProps = {
  title: ReactNode;
  description?: ReactNode;
  /** The form body. */
  children: ReactNode;
  /** Continue button label. Default "Continue →". Step 7 overrides to
   *  "See my site →". */
  continueLabel?: string;
  /** Disable Continue when the current input doesn't meet the step's
   *  requirements (e.g. step 1 demands an industry). */
  continueDisabled?: boolean;
  onContinue: () => void;
  /** When set, renders a "Skip for now" link before Continue. Omit for
   *  step 1 (required). */
  onSkip?: () => void;
  /** When set, renders a "Back" link before Skip / Continue. Omit for
   *  step 1 (no step to go back to). */
  onBack?: () => void;
};

export function StepFrame({
  title,
  description,
  children,
  continueLabel,
  continueDisabled,
  onContinue,
  onSkip,
  onBack,
}: StepFrameProps) {
  return (
    <div className="flex flex-col">
      <h1 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink md:text-[32px] [&_em]:not-italic [&_em]:text-rust">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 text-[14px] leading-[1.55] text-ink-soft md:text-[15px] [&_strong]:font-semibold [&_strong]:text-ink">
          {description}
        </p>
      ) : null}
      <div className="mt-7">{children}</div>
      <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-rust"
            >
              ← Back
            </button>
          ) : null}
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet hover:text-rust"
            >
              Skip for now
            </button>
          ) : null}
        </div>
        <Button
          onClick={onContinue}
          disabled={continueDisabled}
          size="lg"
          className="min-w-[180px]"
        >
          {continueLabel ?? 'Continue →'}
        </Button>
      </div>
    </div>
  );
}
