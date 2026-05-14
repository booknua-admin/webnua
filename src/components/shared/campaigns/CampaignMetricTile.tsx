import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type CampaignMetricTileProps = {
  label: string;
  /** ReactNode so `<em>` highlights rust on the value. */
  value: ReactNode;
  trend?: ReactNode;
  trendTone?: 'good' | 'warn' | 'quiet';
  className?: string;
};

/**
 * Single metric tile inside the active-campaign hero (Client Screen 18).
 * Sized larger than `StatCard` (32px value vs 30px) AND lives inside a parent
 * card with no border/radius of its own — the 1px paper-2 gap between tiles
 * comes from the parent's grid background trick.
 */
function CampaignMetricTile({
  label,
  value,
  trend,
  trendTone = 'quiet',
  className,
}: CampaignMetricTileProps) {
  return (
    <div
      data-slot="campaign-metric-tile"
      className={cn('bg-card px-6 py-5.5', className)}
    >
      <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </div>
      <div className="mb-1.5 text-[32px] font-extrabold leading-none tracking-[-0.03em] text-ink [&_em]:not-italic [&_em]:text-rust">
        {value}
      </div>
      {trend ? (
        <div
          className={cn(
            'text-[12px] leading-[1.4]',
            trendTone === 'good' && 'font-semibold text-good',
            trendTone === 'warn' && 'font-semibold text-warn',
            trendTone === 'quiet' &&
              'text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink',
          )}
        >
          {trend}
        </div>
      ) : null}
    </div>
  );
}

export { CampaignMetricTile };
export type { CampaignMetricTileProps };
