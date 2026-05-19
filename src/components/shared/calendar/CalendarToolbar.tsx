import type { CalendarView } from '@/lib/calendar/types';
import { cn } from '@/lib/utils';

import { CalendarViewTabs } from './CalendarViewTabs';

type CalendarToolbarProps = {
  /** "Week of May 11 — May 16, 2026" — `<em>` segments render rust */
  periodLabel: React.ReactNode;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  className?: string;
};

function CalendarToolbar({
  periodLabel,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  className,
}: CalendarToolbarProps) {
  return (
    <div
      data-slot="calendar-toolbar"
      className={cn(
        'flex items-center justify-between rounded-[10px] border border-rule bg-card px-5 py-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous"
            onClick={onPrev}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-paper-2 font-mono text-[14px] font-bold text-ink hover:bg-paper"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={onNext}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-rule bg-paper-2 font-mono text-[14px] font-bold text-ink hover:bg-paper"
          >
            ›
          </button>
          <button
            type="button"
            onClick={onToday}
            className="ml-1 h-8 rounded-md border border-rule bg-paper-2 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink hover:bg-paper"
          >
            Today
          </button>
        </div>
        <div className="text-[18px] font-extrabold tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
          {periodLabel}
        </div>
      </div>
      <CalendarViewTabs value={view} onChange={onViewChange} />
    </div>
  );
}

export { CalendarToolbar };
export type { CalendarToolbarProps };
