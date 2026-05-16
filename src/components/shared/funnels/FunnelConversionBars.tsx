import { FunnelPeriodToggle } from '@/components/client/funnels/FunnelPeriodToggle';
import type { HubFunnelConversion } from '@/lib/dashboard/hub-types';
import type { FunnelPeriod } from '@/lib/funnels/types';
import { cn } from '@/lib/utils';

type FunnelConversionBarsProps = {
  funnel: HubFunnelConversion;
  className?: string;
};

const HUB_FUNNEL_PERIODS: FunnelPeriod[] = ['7d', '14d', '30d', '90d'];

/**
 * Six horizontal conversion bars (landing → … → reviewed). Distinct from
 * `FunnelFlow` (3-step cards) and `CampaignTrendChart` (grouped bars).
 *
 * Promoted to `shared/` in Cluster 7 (second-surface trigger): used by both the
 * admin single-client overview hub (Screen 20) and the client dashboard
 * (Screen 1).
 */
function FunnelConversionBars({ funnel, className }: FunnelConversionBarsProps) {
  return (
    <div
      data-slot="funnel-conversion-bars"
      className={cn('rounded-xl border border-rule bg-card px-6 py-5.5', className)}
    >
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">Funnel</h2>
          <div className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
            {`${funnel.domain} · ${funnel.periodLabel}`}
          </div>
        </div>
        <FunnelPeriodToggle periods={HUB_FUNNEL_PERIODS} defaultPeriod="7d" />
      </header>

      <div className="flex flex-col gap-2.5">
        {funnel.steps.map((step) => (
          <div key={step.kind} className="grid grid-cols-[190px_1fr_92px] items-center gap-4">
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-ink">{step.label}</div>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                {step.sublabel}
              </div>
            </div>
            <div className="h-7 overflow-hidden rounded-md bg-paper-2">
              <div
                className="h-full rounded-md bg-gradient-to-r from-rust to-rust-light"
                style={{ width: `${step.pct}%` }}
              />
            </div>
            <div className="text-right">
              <div className="font-mono text-[15px] font-bold leading-none text-ink">
                {step.count.toLocaleString()}
              </div>
              <div className="mt-1 font-mono text-[10px] font-bold text-rust">{step.pct}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { FunnelConversionBars };
export type { FunnelConversionBarsProps };
