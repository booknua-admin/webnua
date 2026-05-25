'use client';

// =============================================================================
// ChatGenerationBubble — turn-5 generation-status UI for the conversational
// signup. Compact GenerationSplash equivalent sized for the chat bubble.
//
// Lifecycle (caller-driven via the `status` prop):
//   - 'idle'     → static caption (used for the post-verify "we'll start
//                  building when you finish the turns" preview state).
//   - 'running'  → rotates through GENERATION_PHASES with a pulsing dot,
//                  parks on the final stage indefinitely (the caller
//                  switches to 'ready' or 'failed' when generation
//                  resolves — the bubble never claims done on its own).
//   - 'ready'    → success state with a check + an Open dashboard link.
//   - 'failed'   → warn state with the error message + an optional
//                  Retry button (when the caller passed `onRetry`).
//
// Stage rotation: similar shape to GenerationSplash but compact for the
// chat surface. 5 stages, ~8s each except the final which parks. Stages
// are NOT tied to real generator events — they're an honest reassurance
// pattern (no fake percentage, no claim of real progress). Real streaming
// is its own session.
//
// Back-compat: the previous Session B placeholder exported a `caption`
// prop with no `status`. The new component accepts the same prop with
// `status='idle'` as the default, so the existing shell call site renders
// the same placeholder until the shell wires the real `status`.
// =============================================================================

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

export type GenerationStatus = 'idle' | 'running' | 'ready' | 'failed';

export type ChatGenerationBubbleProps = {
  /** Defaults to 'idle' so the existing Session B placeholder call site
   *  (no props) keeps working until the shell wires the real status. */
  status?: GenerationStatus;
  /** Caption shown in the 'idle' state. */
  caption?: string;
  /** Error text shown in the 'failed' state. */
  errorMessage?: string;
  /** Optional partial-success warning (one arm landed, the other had a
   *  soft error). Shown in the 'ready' state as a secondary note. */
  softError?: string;
  /** Optional retry callback for the 'failed' state. When absent, no
   *  retry button is shown. */
  onRetry?: () => void;
  /** Optional CTA for the 'ready' state — shown as a primary action
   *  ("Open my dashboard →"). The shell owns the navigation. */
  onContinue?: () => void;
  className?: string;
};

/** Stage rotation while `status === 'running'`. The order + timing
 *  approximates the real generators; the final stage parks until the
 *  caller flips to 'ready' or 'failed'. */
const STAGES: readonly { label: string; durationMs: number }[] = [
  { label: 'Reading your brief…', durationMs: 4500 },
  { label: 'Picking the best page layouts…', durationMs: 7000 },
  { label: 'Writing your home page…', durationMs: 12000 },
  { label: 'Drafting your about + services pages…', durationMs: 12000 },
  { label: 'Building your funnel…', durationMs: 14000 },
  // Final — parks indefinitely.
  { label: 'Almost ready…', durationMs: 120000 },
];

export function ChatGenerationBubble({
  status = 'idle',
  caption = 'Generation status will appear here.',
  errorMessage,
  softError,
  onRetry,
  onContinue,
  className,
}: ChatGenerationBubbleProps) {
  if (status === 'idle') {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-rule bg-paper-2 px-3 py-2',
          'font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet',
          className,
        )}
      >
        {caption}
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        className={cn(
          'rounded-lg border border-warn/30 bg-warn/[0.06] px-4 py-3',
          className,
        )}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-[16px] text-warn">!</span>
          <div className="flex-1 text-[13px] leading-[1.5] text-ink">
            <p className="font-bold">Generation failed.</p>
            <p className="mt-0.5 text-ink-mid">
              {errorMessage ?? 'Something went wrong. Try again in a moment.'}
            </p>
          </div>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-md bg-rust px-4 text-[13px] font-bold text-paper hover:bg-rust-deep"
          >
            ↻ Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div
        className={cn(
          'rounded-lg border border-good/30 bg-good/[0.06] px-4 py-3',
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-good text-[11px] font-bold text-paper"
          >
            ✓
          </span>
          <div className="flex-1 text-[13px] leading-[1.5] text-ink">
            <p className="font-bold">Your site is ready.</p>
            <p className="mt-0.5 text-ink-mid">
              Open your dashboard to preview, publish, and start collecting
              leads.
            </p>
          </div>
        </div>
        {softError ? (
          <p className="mt-2 rounded border border-warn/20 bg-warn/[0.05] px-3 py-1.5 font-mono text-[11px] text-warn">
            Note: {softError}
          </p>
        ) : null}
        {onContinue ? (
          <button
            type="button"
            onClick={onContinue}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-md bg-rust px-4 text-[13px] font-bold text-paper hover:bg-rust-deep"
          >
            Open my dashboard →
          </button>
        ) : null}
      </div>
    );
  }

  // status === 'running' — render a separate component so the stage timer's
  // internal state lives there. Each fresh entry into 'running' (e.g. after
  // a Retry) is a fresh mount (the `key={status}` on the wrapper would
  // change), so the stage-progression effect doesn't need a reset-in-effect
  // — the unmount/mount cycle is the reset.
  return <RunningProgress key={status} className={className} />;
}

function RunningProgress({ className }: { className?: string }) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (activeStage >= STAGES.length - 1) return;
    const t = window.setTimeout(
      () => setActiveStage((i) => i + 1),
      STAGES[activeStage].durationMs,
    );
    return () => window.clearTimeout(t);
  }, [activeStage]);

  return (
    <div
      className={cn(
        'rounded-lg border border-rust/30 bg-rust-soft/40 px-4 py-3',
        className,
      )}
      aria-busy
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-rust text-[11px] font-bold text-paper"
        >
          ◆
        </span>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// Building'}
        </p>
      </div>
      <p className="mt-2 text-[13px] font-semibold text-ink">
        {STAGES[Math.min(activeStage, STAGES.length - 1)].label}
      </p>
      <ol className="mt-3 flex flex-col gap-1" aria-label="Generation progress">
        {STAGES.slice(0, 5).map((stage, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < activeStage ? 'done' : i === activeStage ? 'active' : 'pending';
          return (
            <li
              key={stage.label}
              className="flex items-center gap-2 text-[11.5px] leading-[1.4]"
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[8px] font-bold leading-none',
                  state === 'done' && 'bg-good text-paper',
                  state === 'active' && 'animate-pulse bg-rust text-paper',
                  state === 'pending' && 'border border-rule text-transparent',
                )}
              >
                {state === 'done' ? '✓' : '·'}
              </span>
              <span
                className={cn(
                  state === 'done' && 'text-ink-mid line-through decoration-ink-quiet/40',
                  state === 'active' && 'font-semibold text-ink',
                  state === 'pending' && 'text-ink-quiet',
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
        This usually takes 60-90 seconds. Don&apos;t close the window.
      </p>
    </div>
  );
}
