import { cn } from '@/lib/utils';
import type {
  FunnelAggBottom,
  FunnelAggMetric,
} from '@/lib/funnels/types';

type FunnelAggCardProps = {
  label: string;
  live?: boolean;
  metrics: [FunnelAggMetric, FunnelAggMetric];
  bottom?: FunnelAggBottom;
  className?: string;
};

function FunnelAggCard({
  label,
  live = false,
  metrics,
  bottom,
  className,
}: FunnelAggCardProps) {
  return (
    <div
      data-slot="funnel-agg-card"
      className={cn(
        'rounded-[12px] border border-paper/10 bg-paper/[0.06] px-[22px] py-5',
        className,
      )}
    >
      <div className="mb-3.5 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/55">
        <span>{label}</span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 text-good">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-good" />
            LIVE
          </span>
        ) : null}
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-4">
        {metrics.map((metric, i) => (
          <AggMetric key={i} metric={metric} />
        ))}
      </div>

      {bottom ? (
        <div className="flex items-center justify-between border-t border-paper/[0.12] pt-3.5 text-[12px] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
          <span>{bottom.left}</span>
          <span>{bottom.right}</span>
        </div>
      ) : null}
    </div>
  );
}

function AggMetric({ metric }: { metric: FunnelAggMetric }) {
  return (
    <div>
      <div className="text-[28px] font-extrabold leading-none tracking-[-0.025em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
        {metric.num}
      </div>
      <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-paper/55">
        {metric.label}
      </div>
      {metric.trend ? (
        <div className="mt-0.5 text-[11px] font-semibold text-good">
          {metric.trend}
        </div>
      ) : null}
    </div>
  );
}

export { FunnelAggCard };
export type { FunnelAggCardProps };
