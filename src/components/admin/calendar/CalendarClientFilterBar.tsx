'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { CalendarClientFilter } from '@/lib/calendar/types';

type CalendarClientFilterBarProps = {
  filters: CalendarClientFilter[];
  defaultActiveId?: string;
  className?: string;
};

function CalendarClientFilterBar({
  filters,
  defaultActiveId,
  className,
}: CalendarClientFilterBarProps) {
  const [activeId, setActiveId] = useState(
    defaultActiveId ?? filters[0]?.id ?? '',
  );

  return (
    <div
      data-slot="calendar-client-filter-bar"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        // CLIENT
      </span>
      {filters.map((f) => {
        const isActive = f.id === activeId;
        return (
          <button
            key={f.id}
            type="button"
            data-state={isActive ? 'active' : 'inactive'}
            onClick={() => setActiveId(f.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition-colors',
              isActive
                ? 'border-rust bg-rust text-paper'
                : 'border-rule bg-card text-ink-quiet hover:border-ink/30 hover:text-ink',
            )}
          >
            {f.label}
            {typeof f.count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-[1px] font-mono text-[10px]',
                  isActive ? 'bg-paper/15 text-paper' : 'bg-ink/8 text-ink-quiet',
                )}
              >
                {f.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export { CalendarClientFilterBar };
export type { CalendarClientFilterBarProps };
