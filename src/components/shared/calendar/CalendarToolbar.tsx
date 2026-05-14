import { cn } from '@/lib/utils';

import { CalendarViewTabs } from './CalendarViewTabs';

type CalendarToolbarProps = {
  /** "Week of May 11 — May 16, 2026" — `<em>` segments render rust */
  periodLabel: React.ReactNode;
  className?: string;
};

function CalendarToolbar({ periodLabel, className }: CalendarToolbarProps) {
  return (
    <div
      data-slot="calendar-toolbar"
      className={cn(
        'flex items-center justify-between rounded-[10px] border border-rule bg-card px-5 py-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label="Previous week"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-paper-2 font-mono text-[14px] font-bold text-ink hover:bg-paper"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Next week"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-paper-2 font-mono text-[14px] font-bold text-ink hover:bg-paper"
        >
          ›
        </button>
        <div className="text-[18px] font-extrabold tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
          {periodLabel}
        </div>
      </div>
      <CalendarViewTabs />
    </div>
  );
}

export { CalendarToolbar };
export type { CalendarToolbarProps };
