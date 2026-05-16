import Link from 'next/link';

import type { FunnelInsight, FunnelInsightSeverity } from '@/lib/dashboard/hub-types';
import { cn } from '@/lib/utils';

type HubInsightBandProps = {
  insight: FunnelInsight;
  cta: { label: string; href: string };
  className?: string;
};

const SEVERITY_LEAD: Record<FunnelInsightSeverity, string> = {
  good: 'Funnel performing well',
  opportunity: 'Performing well — one opportunity',
  warn: 'Funnel needs attention',
};

const ACTION_PREFIX: Record<FunnelInsightSeverity, string> = {
  good: '',
  opportunity: 'Opportunity:',
  warn: 'Action:',
};

/**
 * The thin ink-bg insight strip at the foot of the single-client hub (Screen
 * 20). Composes its sentence from the structured `FunnelInsight` parts —
 * lead phrase, evidence, action — never a stored prose blob (vision §7).
 *
 * Built as a thin sibling rather than reusing `CampaignManagedBand`: that
 * component's 56px icon tile + 20px headline is a chunkier shape than this
 * one-line strip, so reuse would have fought. (Evaluate-at-build outcome.)
 */
function HubInsightBand({ insight, cta, className }: HubInsightBandProps) {
  const showAction = insight.severity !== 'good';

  return (
    <div
      data-slot="hub-insight-band"
      className={cn(
        'flex items-center justify-between gap-6 rounded-[12px] bg-ink px-6 py-4 text-paper',
        className,
      )}
    >
      <p className="text-[13px] leading-[1.55] text-paper/75">
        <strong className="font-bold text-paper">{SEVERITY_LEAD[insight.severity]}</strong> —{' '}
        {insight.reasoning}
        {showAction ? (
          <span className="font-semibold text-rust-light">
            {' '}
            {ACTION_PREFIX[insight.severity]} {insight.suggestedAction}.
          </span>
        ) : null}
      </p>
      <Link
        href={cta.href}
        className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-rust-light transition-colors hover:text-paper"
      >
        {cta.label}
      </Link>
    </div>
  );
}

export { HubInsightBand };
export type { HubInsightBandProps };
