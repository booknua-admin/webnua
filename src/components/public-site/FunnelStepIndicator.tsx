// =============================================================================
// FunnelStepIndicator — small progress strip on multi-step funnels (FIX F).
//
// Rendered ABOVE the funnel's `<main>` on every step EXCEPT the landing (the
// landing is the first visitor impression — no need to telegraph "you're
// 1/N here"; the indicator helps once they've committed). On a single-step
// funnel (stepCount === 1) the renderer omits the indicator entirely.
//
// Brand-aware styling: the active segment + the count text inherit the
// brand accent so the indicator visually matches the funnel's design bundle.
// The strip is intentionally minimal — a thin progress bar + a mono label —
// to stay out of the funnel's own hero / form chrome.
// =============================================================================

import type { BrandObject } from '@/lib/website/types';

type Props = {
  brand: BrandObject;
  /** 0-based step index — resolver-set. The landing step is 0; renderer hides
   *  the indicator there (the FunnelStepIndicator mounter, not this component). */
  stepIndex: number;
  /** Total number of steps. */
  stepCount: number;
};

export function FunnelStepIndicator({ brand, stepIndex, stepCount }: Props) {
  // Guard the math in case a caller mounts the component without the
  // renderer's gating. Returns null for the landing step or a single-step
  // funnel so the component is also safe to mount unconditionally.
  if (stepCount <= 1 || stepIndex <= 0 || stepIndex >= stepCount) return null;

  const accent = brand.accentColor || '#d24317';
  // Inclusive percentage — step 2 of 3 reads "67%" not "50%". The visitor's
  // CURRENT step is finished from the prior step's POV; the progress fill
  // represents "how far through" the funnel, not "how many remain".
  const pct = Math.round(((stepIndex + 1) / stepCount) * 100);
  const human = `Step ${stepIndex + 1} of ${stepCount}`;

  return (
    <div
      role="progressbar"
      aria-label={human}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="w-full border-b border-black/5 bg-white"
    >
      <div className="mx-auto flex max-w-[1100px] flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          {human}
        </span>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-black/8 sm:w-[260px]"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${pct}%`,
              backgroundColor: accent,
            }}
          />
        </div>
      </div>
    </div>
  );
}
