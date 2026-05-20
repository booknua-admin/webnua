'use client';

// =============================================================================
// LeadCompletionFilter — funnel-run completion filter on the leads inbox.
//
// IMPORTANT: this is an ACTION filter, not a lead-quality grade. Operators
// see "Leads captured: N" as the headline metric (analytics-audit §5.1);
// this filter is for the operator's "show me leads who only submitted step
// 1 — these might benefit from a follow-up nudge" workflow. Language and
// default state both reflect that.
//
//   • Default = "All" (opt-in narrowing, not a forced segmentation)
//   • "Still in progress" = single form_submitted (one step done)
//   • "Completed" = ≥ 2 form_submitted (both steps landed)
//
// The completion axis is derived at read time from `lead_events` — see
// `lib/leads/queries.tsx#deriveCompletion`. Closes the inbox piece of the
// analytics-audit §2.6 / CLAUDE.md "Funnel analytics gaps that remain after
// lead threading" cluster.
// =============================================================================

import { cn } from '@/lib/utils';

export type LeadCompletionFilterValue = 'all' | 'in_progress' | 'completed';

const OPTIONS: { id: LeadCompletionFilterValue; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'Still in progress' },
  { id: 'completed', label: 'Completed' },
];

export function LeadCompletionFilter({
  value,
  onChange,
  className,
}: {
  value: LeadCompletionFilterValue;
  onChange: (next: LeadCompletionFilterValue) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet',
        className,
      )}
    >
      <span aria-hidden>{'// FUNNEL RUN'}</span>
      <div
        role="group"
        aria-label="Filter by funnel-run completion"
        className="flex items-center gap-1 rounded-full border border-ink/8 bg-paper p-1"
      >
        {OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
              className={cn(
                'h-7 rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors',
                active
                  ? 'bg-ink text-paper'
                  : 'text-ink-quiet hover:text-ink',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
