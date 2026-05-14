'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import {
  FUNNEL_PERIOD_LABEL,
  type FunnelPeriod,
} from '@/lib/funnels/types';

type FunnelPeriodToggleProps = {
  periods: FunnelPeriod[];
  defaultPeriod?: FunnelPeriod;
  onChange?: (period: FunnelPeriod) => void;
  className?: string;
};

function FunnelPeriodToggle({
  periods,
  defaultPeriod,
  onChange,
  className,
}: FunnelPeriodToggleProps) {
  const [active, setActive] = useState<FunnelPeriod>(
    defaultPeriod ?? periods[0],
  );

  return (
    <div
      data-slot="funnel-period-toggle"
      className={cn(
        'inline-flex gap-1 rounded-pill bg-paper p-[3px]',
        className,
      )}
    >
      {periods.map((period) => {
        const isActive = period === active;
        return (
          <button
            key={period}
            type="button"
            onClick={() => {
              setActive(period);
              onChange?.(period);
            }}
            className={cn(
              'rounded-pill px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] transition-colors',
              isActive
                ? 'bg-ink text-paper'
                : 'text-ink-quiet hover:text-ink',
            )}
          >
            {FUNNEL_PERIOD_LABEL[period]}
          </button>
        );
      })}
    </div>
  );
}

export { FunnelPeriodToggle };
export type { FunnelPeriodToggleProps };
