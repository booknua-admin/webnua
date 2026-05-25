'use client';

// =============================================================================
// /dev/blueprint-preview — off-nav dev surface for the GenerationBlueprint
// component. Mounts the component in isolation with a tiny control panel
// so you can flip through the phases + see the SVG draw-in animations
// without going through the full /sign-up flow.
//
// Convention: `app/dev/*` is off-nav developer-only. Don't link to it from
// production nav. Deletion-point lives alongside /dev/sections.
// =============================================================================

import { useState } from 'react';

import {
  GenerationBlueprint,
  type BlueprintPhase,
} from '@/components/shared/onboarding/GenerationBlueprint';

const PHASES: BlueprintPhase[] = [
  'idle',
  'probing',
  'generating-site',
  'generating-funnel',
  'persisting',
  'ready',
  'failed',
];

export default function BlueprintPreviewPage() {
  const [phase, setPhase] = useState<BlueprintPhase>('probing');
  const [attemptId, setAttemptId] = useState(0);
  const [industry, setIndustry] = useState('painters');
  const [serviceCount, setServiceCount] = useState(7);
  const [businessName, setBusinessName] = useState('Cork Painters');

  return (
    <>
      {/* Control panel — fixed top-right above the blueprint's z-50 */}
      <div className="fixed top-3 left-1/2 z-[60] flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-rule bg-card px-3 py-2 shadow-card max-w-[95vw]">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink-quiet">
          {'// dev preview'}
        </span>
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={
              'inline-flex h-7 items-center rounded px-2 font-mono text-[10px] uppercase tracking-[0.12em] ' +
              (phase === p
                ? 'bg-ink text-paper'
                : 'border border-rule text-ink-quiet hover:bg-paper-2')
            }
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => setAttemptId((id) => id + 1)}
          className="inline-flex h-7 items-center rounded border border-rust px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-rust"
        >
          reset visual
        </button>
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="industry"
          className="h-7 w-24 rounded border border-rule bg-paper px-2 text-[11px]"
        />
        <input
          type="number"
          value={serviceCount}
          onChange={(e) => setServiceCount(Number(e.target.value) || 0)}
          placeholder="services"
          className="h-7 w-14 rounded border border-rule bg-paper px-2 text-[11px]"
        />
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="business"
          className="h-7 w-36 rounded border border-rule bg-paper px-2 text-[11px]"
        />
      </div>

      <GenerationBlueprint
        phase={phase}
        industryDisplay={industry}
        serviceCount={serviceCount}
        businessName={businessName || undefined}
        errorMessage={
          phase === 'failed'
            ? 'Claude returned a 500. This is almost always transient — try again and it should go through.'
            : undefined
        }
        softError={
          phase === 'ready'
            ? undefined
            : undefined
        }
        attemptId={attemptId}
        onRetry={() => {
          setAttemptId((id) => id + 1);
          setPhase('probing');
        }}
        onContinue={() => alert('Continue clicked — in production this routes to /dashboard.')}
      />
    </>
  );
}
