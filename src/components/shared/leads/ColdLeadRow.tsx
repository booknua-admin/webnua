'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useDismissFollowup } from '@/lib/leads/queries';
import type {
  AdminLeadRow,
  ClientLeadRow,
} from '@/lib/leads/types';
import { cn } from '@/lib/utils';

import { LeadClientPill } from './pills';

type ColdLeadRowProps = {
  variant: 'client' | 'admin';
  row: ClientLeadRow | AdminLeadRow;
};

/**
 * The "Needs follow-up" tab row (Phase 8 Session 2). One row per cold lead
 * with a warn-tinted left rail + a "Dismiss" affordance + a click-through to
 * the lead conversation (where the operator/client writes the manual nudge).
 *
 * Distinct from `LeadRow` (the inbox row family) because:
 *   • The dominant signal is "this needs your attention now", not status.
 *   • The dismiss button replaces the activity-meta cell.
 *   • The cold lead's age signal is `days since last outbound`, not
 *     `time since lead was created`.
 *
 * The dismiss button POSTs to /api/leads/[id]/dismiss-followup. Sending a
 * manual reply via the conversation composer auto-dismisses the lead — the
 * dismiss button here is for the "I'll handle this offline" path.
 */
function ColdLeadRow({ variant, row }: ColdLeadRowProps) {
  const [dismissing, setDismissing] = useState(false);
  const dismiss = useDismissFollowup();

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissing(true);
    dismiss.mutate(row.id, {
      onError: () => setDismissing(false),
    });
  };

  // The "days since last outbound" display only needs to be stable per row
  // across re-renders; it doesn't tick. `useMemo` captures one Date.now() at
  // commit-time per row. The purity lint rule fires anyway so we silence it
  // at the exact site.
  const daysSinceOutbound = useMemo(() => {
    if (row.lastOutboundAt === null) return null;
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return Math.max(0, Math.floor((now - Date.parse(row.lastOutboundAt)) / 86_400_000));
  }, [row.lastOutboundAt]);

  const ageLabel =
    daysSinceOutbound === null
      ? 'No outbound on file'
      : daysSinceOutbound === 0
      ? 'Touched today'
      : `Touched ${daysSinceOutbound}d ago`;

  const adminClientPill =
    variant === 'admin'
      ? (row as AdminLeadRow).clientName
      : null;

  return (
    <div
      data-slot="cold-lead-row"
      className={cn(
        'relative border-b border-ink/8 transition-colors last:border-b-0 hover:bg-warn-soft/10',
      )}
    >
      <Link
        href={`/leads/${row.id}`}
        className="absolute inset-0"
        aria-label={`Open conversation with ${row.name}`}
      />
      {/* Mobile — stacked card */}
      <div className="flex flex-col gap-2 border-l-[3px] border-warn px-4 py-3 md:hidden">
        <div className="flex items-start gap-3">
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-warn-soft text-[11px] font-bold text-warn">
            {row.initial}
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 font-sans text-[14px] font-bold text-ink">
              <span className="truncate">{row.name}</span>
              {adminClientPill ? (
                <LeadClientPill
                  name={adminClientPill}
                  tone={(row as AdminLeadRow).clientTone}
                />
              ) : null}
            </div>
            <div className="mt-0.5 line-clamp-2 font-sans text-[12px] text-ink-quiet">
              {row.preview}
            </div>
          </div>
        </div>
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warn">
              Nudge #{row.nudgeCount} · cold
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {ageLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={dismissing}
            className={cn(
              'relative inline-flex h-9 shrink-0 items-center rounded-md border border-rule bg-card px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet transition-colors',
              'hover:border-ink hover:text-ink',
              dismissing && 'opacity-55',
            )}
          >
            {dismissing ? 'Dismissing…' : 'Dismiss ✓'}
          </button>
        </div>
      </div>
      {/* Desktop — original 6-col grid */}
      <div
        className={cn(
          'hidden items-center gap-3 px-[18px] py-3.5',
          'md:grid md:grid-cols-[4px_36px_1fr_140px_120px_auto]',
        )}
      >
        <div aria-hidden className="h-[28px] rounded-r-sm bg-warn" />
        <div className="relative flex size-9 items-center justify-center rounded-full bg-warn-soft text-[11px] font-bold text-warn">
          {row.initial}
        </div>
        <div className="relative min-w-0">
          <div className="flex items-center gap-2 truncate font-sans text-[14px] font-bold text-ink">
            {row.name}
            {adminClientPill ? (
              <LeadClientPill
                name={adminClientPill}
                tone={(row as AdminLeadRow).clientTone}
              />
            ) : null}
          </div>
          <div className="mt-0.5 truncate font-sans text-[12px] text-ink-quiet">
            {row.preview}
          </div>
        </div>
        <div className="relative font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warn">
          Nudge #{row.nudgeCount} · cold
        </div>
        <div className="relative font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {ageLabel}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          className={cn(
            'relative inline-flex h-7 items-center rounded-md border border-rule bg-card px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet transition-colors',
            'hover:border-ink hover:text-ink',
            dismissing && 'opacity-55',
          )}
        >
          {dismissing ? 'Dismissing…' : 'Dismiss ✓'}
        </button>
      </div>
    </div>
  );
}

export { ColdLeadRow };
export type { ColdLeadRowProps };
