'use client';

// =============================================================================
// ChatThinkingPhases — the "AI is thinking like a web designer" surface
// mounted between the business-name turn and the services picker.
//
// Replaces a silent wait with a specific, paced display of what the
// industry-knowledge AI call is doing in the background. Matches the
// blueprint aesthetic from GenerationBlueprint (dashed pending squares,
// pulsing rust dots, ink checkmarks) so the chat -> build transition
// reads as one continuous workflow.
//
// Pure visual — the parent decides when to unmount based on the actual
// industry-knowledge resolution + min/max gating. The component itself
// cycles the active phase on a fixed cadence and parks on the final
// phase until the parent unmounts it.
//
// Phase strings are interpolated with the business descriptor ("wedding
// photographer", "electrician") so the customer sees the AI working on
// THEIR business, not a generic loading state.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

type ChatThinkingPhasesProps = {
  /** Human-readable business descriptor used in the phase copy
   *  ("wedding photographer", "electrician", "mobile car valeting").
   *  Lower-cased + trimmed for display. */
  businessLabel: string;
};

/** Per-phase advance cadence. 2.2s is the read-and-absorb sweet spot —
 *  longer and the customer wonders if it's stuck; shorter and the lines
 *  flash by before they can read. Matches the blueprint's stage cadence. */
const PHASE_INTERVAL_MS = 2200;

export function ChatThinkingPhases({ businessLabel }: ChatThinkingPhasesProps) {
  const phases = useMemo(() => buildPhases(businessLabel), [businessLabel]);
  const [activeIndex, setActiveIndex] = useState(0);

  // Cycle the active phase on the fixed cadence; stop on the last entry
  // so the final "synthesising" line stays put until the parent unmounts
  // (which is the moment industryKnowledge resolves OR the max timer fires).
  useEffect(() => {
    if (activeIndex >= phases.length - 1) return;
    const id = setTimeout(() => {
      setActiveIndex((i) => Math.min(i + 1, phases.length - 1));
    }, PHASE_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [activeIndex, phases.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy
      className="rounded-2xl border-2 border-ink/15 bg-paper/80 px-4 py-3.5 shadow-card animate-in fade-in duration-300"
    >
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        <span aria-hidden className="inline-block animate-spin">
          ✦
        </span>
        <span>{'// thinking'}</span>
      </div>
      <ol className="flex flex-col gap-2">
        {phases.map((phase, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          return (
            <li key={i} className="flex items-start gap-2.5">
              <StatusGlyph state={state} />
              <span
                className={cn(
                  'text-[13px] leading-[1.4]',
                  state === 'done' && 'text-ink-quiet line-through decoration-ink-quiet/40',
                  state === 'active' && 'text-ink font-medium',
                  state === 'pending' && 'text-ink-quiet/60',
                )}
              >
                {phase}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Compose the six-step "web-designer thinking" sequence. Each line names
 *  a concrete thing the AI is doing — researching, mapping, drafting —
 *  with the customer's business descriptor woven in so the display reads
 *  as bespoke, not boilerplate. */
function buildPhases(rawLabel: string): readonly string[] {
  const label = rawLabel.trim().toLowerCase() || 'service';
  // Pluralise softly — "wedding photographer" → "wedding photographer
  // businesses"; "electrician" → "electrician businesses". The simple
  // append-business form reads naturally in every case we've seen and
  // avoids fragile pluralisation rules.
  const plural = `${label} businesses`;
  return [
    `Researching top-ranked ${plural}…`,
    `Studying what's converting in this space…`,
    `Mapping the customer journey for ${plural}…`,
    `Pulling design inspiration from leading sites…`,
    `Finding top-performing offers for ${plural}…`,
    `Drafting your service shortlist…`,
  ];
}

/** Status glyph mirrored from GenerationBlueprint's stage list — the
 *  shared aesthetic ties the chat-side "thinking" surface to the
 *  build-side blueprint sheet so they read as one continuous workflow.
 *  Pending = dashed empty square; active = pulsing rust dot; done = an
 *  ink check that draws in on first reveal via the shared @keyframes. */
function StatusGlyph({ state }: { state: 'done' | 'active' | 'pending' }) {
  return (
    <span
      aria-hidden
      className="relative mt-[2px] inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center"
    >
      <svg viewBox="0 0 14 14" className="h-full w-full" aria-hidden>
        <rect
          x="1.5"
          y="1.5"
          width="11"
          height="11"
          rx="1.5"
          fill="none"
          strokeWidth={state === 'pending' ? '1' : '1.4'}
          strokeDasharray={state === 'pending' ? '2 2' : undefined}
          className={cn(
            state === 'done' && 'stroke-ink/70',
            state === 'active' && 'stroke-rust',
            state === 'pending' && 'stroke-ink/30',
          )}
        />
        {state === 'done' ? (
          <path
            d="M3.8 7.2 L6 9.4 L10.4 4.6"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-ink [stroke-dasharray:24] [stroke-dashoffset:24] animate-[draw_0.45s_ease-out_forwards]"
          />
        ) : null}
        {state === 'active' ? (
          <circle cx="7" cy="7" r="2.2" className="fill-rust animate-pulse" />
        ) : null}
      </svg>
    </span>
  );
}
