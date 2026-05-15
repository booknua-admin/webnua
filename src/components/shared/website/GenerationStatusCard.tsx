'use client';

// =============================================================================
// GenerationStatusCard — ink-bg "// GENERATING ✦" card mounted at the tail
// of the form-to-page flow. Phase copy rotates through GENERATION_PHASES
// (lib/website/generation-stub.ts) on a fixed 1.6s interval.
//
// Framing rule (design doc §1): Q4/Q5 must read as "received, will be
// applied" — NOT "being applied right now." So the optional answers live
// in a dedicated `// RECEIVED` footer block with ✓ check glyphs, distinct
// from the phase copy above.
// =============================================================================

import { useEffect, useState } from 'react';

import { GENERATION_PHASES } from '@/lib/website/generation-stub';

type GenerationStatusCardProps = {
  /** Verbatim Q4 answer, if non-empty. */
  specifics?: string | null;
  /** Verbatim Q5 answer, if non-empty. */
  avoid?: string | null;
};

function GenerationStatusCard({ specifics, avoid }: GenerationStatusCardProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex((i) => (i + 1) % GENERATION_PHASES.length);
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  const hasSpecifics = !!specifics && specifics.trim().length > 0;
  const hasAvoid = !!avoid && avoid.trim().length > 0;

  return (
    <div className="mx-auto my-12 max-w-[640px] overflow-hidden rounded-2xl border border-ink bg-ink px-10 py-12 text-paper">
      <p className="mb-7 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-rust-light">
        {'// GENERATING ✦'}
      </p>
      <div className="mb-8 flex items-center gap-4">
        <span
          aria-hidden
          className="flex h-12 w-12 animate-spin items-center justify-center rounded-full bg-rust/[0.18] text-[24px] text-rust-light"
          style={{ animationDuration: '2.4s' }}
        >
          ✦
        </span>
        <div>
          <p className="text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em]">
            Drafting your page…
          </p>
          <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.12em] text-paper/70">
            {GENERATION_PHASES[phaseIndex]}
          </p>
        </div>
      </div>

      {(hasSpecifics || hasAvoid) && (
        <div className="border-t border-paper/15 pt-6">
          <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-paper/55">
            {'// RECEIVED'}
          </p>
          <ul className="space-y-1.5 text-[13px] leading-[1.5]">
            {hasSpecifics && (
              <li className="flex items-baseline gap-2">
                <span className="text-good">✓</span>
                <span className="text-paper/85">
                  Got your specifics — will shape the final draft.
                </span>
              </li>
            )}
            {hasAvoid && (
              <li className="flex items-baseline gap-2">
                <span className="text-good">✓</span>
                <span className="text-paper/85">
                  Got your avoid notes — will be honoured.
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export { GenerationStatusCard };
