'use client';

// =============================================================================
// AnglePickerCards — three side-by-side angle cards on the Generate surface.
//
// Phase 7.5 · Session 2.1. Renders the three GeneratedAngle objects returned
// by /api/integrations/meta_ads/generate-angles as picker cards. Each card
// carries:
//   • An eyebrow chip: PAIN-LED / OUTCOME-LED / TRUST-LED.
//   • A one-sentence rationale ("why this angle for this customer") —
//     Sonnet writes this referring to something concrete from the brief.
//   • The angle's variants' headlines stacked underneath as a preview.
//   • A checkbox in the corner (top-right) to include / exclude the angle.
//
// Selection is controlled by the parent (GenerateAdsView). The picker is
// purely presentational — it never decides defaults or fires the launch.
//
// Webnua-authored — Webnua palette tokens only (no shadcn roles beyond
// the sanctioned bg-card on the card surface).
// =============================================================================

import type { GeneratedAngle } from '@/lib/integrations/meta-ads/generate-angles';

export type AnglePickerCardsProps = {
  angles: readonly GeneratedAngle[];
  /** Set of angle ids currently picked. */
  selected: ReadonlySet<string>;
  /** Toggle a single angle. */
  onToggle: (angleId: string, selected: boolean) => void;
};

// Per-angle tonal seasoning. The cards stay paper-on-white surfaces —
// the seasoning is in the eyebrow chip + the rust-soft active border so
// the operator can tell at a glance which angle is which.
const ANGLE_TONE: Record<
  string,
  { eyebrow: string; chipBg: string; chipText: string }
> = {
  pain: {
    eyebrow: '// PAIN-LED',
    chipBg: 'bg-warn-soft',
    chipText: 'text-warn',
  },
  outcome: {
    eyebrow: '// OUTCOME-LED',
    chipBg: 'bg-good-soft',
    chipText: 'text-good',
  },
  trust: {
    eyebrow: '// TRUST-LED',
    chipBg: 'bg-info-soft',
    chipText: 'text-info',
  },
};

const ANGLE_FALLBACK_TONE = {
  eyebrow: '// ANGLE',
  chipBg: 'bg-paper-2',
  chipText: 'text-ink',
};

export function AnglePickerCards({
  angles,
  selected,
  onToggle,
}: AnglePickerCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {angles.map((angle) => (
        <AngleCard
          key={angle.id}
          angle={angle}
          selected={selected.has(angle.id)}
          onToggle={(value) => onToggle(angle.id, value)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AngleCard({
  angle,
  selected,
  onToggle,
}: {
  angle: GeneratedAngle;
  selected: boolean;
  onToggle: (selected: boolean) => void;
}) {
  const tone = ANGLE_TONE[angle.id] ?? ANGLE_FALLBACK_TONE;
  const borderClass = selected
    ? 'border-rust shadow-card'
    : 'border-rule hover:border-rust/50';
  return (
    <button
      type="button"
      onClick={() => onToggle(!selected)}
      aria-pressed={selected}
      className={`group relative flex flex-col gap-3 rounded-xl border bg-card px-5 py-5 text-left transition-colors ${borderClass}`}
    >
      <span
        className={`absolute right-4 top-4 inline-flex h-5 w-5 items-center justify-center rounded border ${
          selected
            ? 'border-rust bg-rust text-paper'
            : 'border-rule bg-paper text-transparent group-hover:border-rust'
        }`}
        aria-hidden="true"
      >
        <CheckGlyph />
      </span>

      <div
        className={`inline-flex w-fit items-center rounded-full ${tone.chipBg} px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${tone.chipText}`}
      >
        {tone.eyebrow}
      </div>

      <h3 className="pr-7 text-[18px] font-semibold tracking-tight text-ink">
        {angle.label}
      </h3>

      <p className="text-[13px] leading-snug text-ink-soft">
        {angle.rationale}
      </p>

      <div className="mt-1 flex flex-col gap-2 border-t border-paper-2 pt-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {angle.variants.length} variant
          {angle.variants.length === 1 ? '' : 's'}
        </span>
        <ul className="flex flex-col gap-1.5">
          {angle.variants.map((v, i) => (
            <li
              key={i}
              className="rounded-md bg-paper px-2.5 py-1.5 text-[12px] font-medium leading-snug text-ink"
            >
              “{v.headline}”
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

function CheckGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 6.5 L4.5 9 L10 3" />
    </svg>
  );
}
