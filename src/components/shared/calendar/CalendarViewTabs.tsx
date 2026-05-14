'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

type CalendarView = 'day' | 'week' | 'month';

type CalendarViewTabsProps = {
  defaultView?: CalendarView;
  onChange?: (view: CalendarView) => void;
  className?: string;
};

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

function CalendarViewTabs({
  defaultView = 'week',
  onChange,
  className,
}: CalendarViewTabsProps) {
  const [view, setView] = useState<CalendarView>(defaultView);
  return (
    <div
      data-slot="calendar-view-tabs"
      className={cn(
        'inline-flex gap-1 rounded-lg bg-paper-2 p-[3px]',
        className,
      )}
    >
      {VIEWS.map((v) => {
        const isActive = v.id === view;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setView(v.id);
              onChange?.(v.id);
            }}
            data-state={isActive ? 'active' : 'inactive'}
            className={cn(
              'rounded-md px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors',
              isActive ? 'bg-ink text-paper' : 'text-ink-quiet hover:text-ink',
            )}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

export { CalendarViewTabs };
export type { CalendarView, CalendarViewTabsProps };
