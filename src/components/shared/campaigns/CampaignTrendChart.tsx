import { cn } from '@/lib/utils';
import type { CampaignTrendChartData } from '@/lib/campaigns/types';

type CampaignTrendChartProps = {
  data: CampaignTrendChartData;
  className?: string;
};

/**
 * CSS-only 4-week grouped-bar chart for client `/campaigns` (leads vs spend).
 * No chart library — the prototype shape is small enough that hand-rolling
 * is cleaner than pulling in a dep. Each week column renders two stacked-end
 * bars: leads (rust filled) + spend (paper-2 outlined), scaled against the
 * configured `leadsMax` / `spendMax`. The "current" week gets a rust glow.
 */
function CampaignTrendChart({ data, className }: CampaignTrendChartProps) {
  return (
    <div
      data-slot="campaign-trend-chart"
      className={cn(
        'rounded-xl border border-rule bg-card px-6 py-5.5',
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-1 text-[16px] font-extrabold tracking-[-0.015em] text-ink [&_em]:not-italic [&_em]:text-rust">
            {data.title}
          </div>
          <p className="text-[12px] leading-[1.4] text-ink-quiet">{data.sub}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
            <span className="block h-3 w-3 rounded-[3px] bg-rust" />
            {data.legendLeadsLabel}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
            <span className="block h-3 w-3 rounded-[3px] border border-rule bg-paper-2" />
            {data.legendSpendLabel}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[60px_1fr] gap-3.5">
        <div className="flex flex-col justify-between pb-[22px] text-right font-mono text-[10px] tracking-[0.04em] text-ink-quiet">
          {data.yAxisLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 bottom-[22px] flex flex-col justify-between"
          >
            {data.yAxisLabels.map((label) => (
              <span key={label} className="block h-px bg-paper-2" />
            ))}
          </div>
          <div className="relative z-[1] flex h-[200px] items-end gap-4">
            {data.weeks.map((week) => {
              const leadsPct = Math.max(
                (week.leads / data.leadsMax) * 100,
                2,
              );
              const spendPct = Math.max(
                (week.spend / data.spendMax) * 100,
                2,
              );
              return (
                <div
                  key={week.label}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex h-[200px] w-full items-end gap-1">
                    <div
                      className={cn(
                        'relative min-h-[4px] flex-1 rounded-t-[4px] bg-rust',
                        week.current &&
                          'shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-rust)_20%,transparent)]',
                      )}
                      style={{ height: `${leadsPct}%` }}
                    >
                      <span className="absolute -top-[22px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-ink">
                        {week.leads}
                      </span>
                    </div>
                    <div
                      className="relative min-h-[4px] flex-1 rounded-t-[4px] border border-rule bg-paper-2"
                      style={{ height: `${spendPct}%` }}
                    >
                      <span className="absolute -top-[22px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-ink-quiet">
                        ${week.spend}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      'text-center font-mono text-[10px] tracking-[0.06em]',
                      week.current
                        ? 'font-extrabold text-rust'
                        : 'font-bold text-ink-quiet',
                    )}
                  >
                    {week.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export { CampaignTrendChart };
export type { CampaignTrendChartProps };
