import Link from 'next/link';

import type { ClientFunnelSummary } from '@/lib/dashboard/client-dashboard-types';
import { cn } from '@/lib/utils';

type FunnelSummaryBandProps = {
  summary: ClientFunnelSummary;
  className?: string;
};

/**
 * The ink-bg funnel-summary strip below the conversion bars on the client
 * dashboard (Screen 1). Composes plain prose from the structured
 * `ClientFunnelSummary` parts — weak point, operator note, health note.
 *
 * Sibling of the operator hub's `HubInsightBand` (not a reuse): that component
 * consumes a structured `FunnelInsight` with severity + suggested-action; the
 * client framing is plainer and carries an operator-note slot instead. Two
 * clean siblings beat one component with conditional slots.
 */
function FunnelSummaryBand({ summary, className }: FunnelSummaryBandProps) {
  const { weakPoint } = summary;

  return (
    <div
      data-slot="funnel-summary-band"
      className={cn(
        'flex items-center justify-between gap-6 rounded-[12px] bg-ink px-6 py-4 text-paper',
        className,
      )}
    >
      <p className="text-[13px] leading-[1.55] text-paper/75">
        <strong className="font-bold text-paper">
          {weakPoint.fromLabel} → {weakPoint.toLabel} is your weak point
        </strong>{' '}
        — {weakPoint.dropCount} people start the form then drop.{' '}
        <span className="font-semibold text-rust-light">{summary.operatorNote}</span>{' '}
        {summary.healthNote}
      </p>
      <Link
        href={summary.cta.href}
        className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-rust-light transition-colors hover:text-paper"
      >
        {summary.cta.label}
      </Link>
    </div>
  );
}

export { FunnelSummaryBand };
export type { FunnelSummaryBandProps };
