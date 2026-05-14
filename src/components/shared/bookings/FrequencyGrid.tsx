'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { RecurringFrequencyOption } from '@/lib/bookings/recurring-setup';

type FrequencyGridProps = {
  options: RecurringFrequencyOption[];
  defaultId?: RecurringFrequencyOption['id'];
  onChange?: (id: RecurringFrequencyOption['id']) => void;
  className?: string;
};

function FrequencyGrid({
  options,
  defaultId,
  onChange,
  className,
}: FrequencyGridProps) {
  const [activeId, setActiveId] = useState<
    RecurringFrequencyOption['id'] | undefined
  >(defaultId ?? options[0]?.id);

  return (
    <div
      data-slot="frequency-grid"
      className={cn('grid grid-cols-4 gap-2.5', className)}
    >
      {options.map((o) => {
        const isActive = o.id === activeId;
        return (
          <button
            key={o.id}
            type="button"
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => {
              setActiveId(o.id);
              onChange?.(o.id);
            }}
            className={cn(
              'rounded-[10px] border px-3.5 py-3.5 text-center transition-colors',
              isActive
                ? 'border-rust bg-rust-soft'
                : 'border-rule bg-paper hover:border-rust',
            )}
          >
            <div className="mb-0.5 text-[14px] font-bold text-ink">{o.name}</div>
            <div
              className={cn(
                'font-mono text-[10px] tracking-[0.04em]',
                isActive ? 'text-rust' : 'text-ink-quiet',
              )}
            >
              {o.meta}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { FrequencyGrid };
export type { FrequencyGridProps };
