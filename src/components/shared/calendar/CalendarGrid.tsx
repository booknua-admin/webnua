import { cn } from '@/lib/utils';
import type { CalendarWeek } from '@/lib/calendar/types';

import { BookingPill } from './BookingPill';
import { CalendarNowLine } from './CalendarNowLine';

type CalendarGridProps = {
  week: CalendarWeek;
  className?: string;
};

const GRID_COLS = 'grid-cols-[70px_repeat(6,1fr)]';

function CalendarGrid({ week, className }: CalendarGridProps) {
  return (
    <div
      data-slot="calendar-grid"
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-rule bg-card',
        className,
      )}
    >
      <div
        className={cn(
          'grid border-b border-rule bg-paper-2',
          GRID_COLS,
        )}
      >
        <div className="flex items-center justify-center border-r border-rule-soft px-2 py-3.5 text-center font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
          {week.cornerLabel}
        </div>
        {week.days.map((day, idx) => (
          <div
            key={day.id}
            className={cn(
              'px-2 py-3.5 text-center',
              idx < week.days.length - 1 && 'border-r border-rule-soft',
              day.isToday && 'bg-ink',
            )}
          >
            <div
              className={cn(
                'mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
                day.isToday ? 'text-paper/65' : 'text-ink-quiet',
              )}
            >
              {day.name}
            </div>
            <div
              className={cn(
                'text-[22px] font-extrabold leading-none tracking-[-0.025em]',
                day.isToday ? 'text-rust-light' : 'text-ink',
              )}
            >
              {day.num}
            </div>
          </div>
        ))}
      </div>

      <div className={cn('relative grid', GRID_COLS)}>
        <div className="border-r border-rule-soft bg-paper">
          {week.timeSlots.map((slot) => (
            <div
              key={slot}
              className="h-[50px] border-b border-paper-2 px-2 py-1 text-right font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-quiet"
            >
              {slot}
            </div>
          ))}
        </div>

        {week.days.map((day, idx) => (
          <div
            key={day.id}
            className={cn(
              'relative',
              idx < week.days.length - 1 && 'border-r border-rule-soft',
              day.isToday && 'bg-[rgba(210,67,23,0.025)]',
            )}
          >
            {week.timeSlots.map((slot) => (
              <div
                key={`${day.id}-${slot}`}
                className="h-[50px] border-b border-paper-2"
              />
            ))}
            {day.bookings.map((b) => (
              <BookingPill
                key={b.id}
                time={b.time}
                title={b.title}
                customer={b.customer}
                top={b.top}
                height={b.height}
                tone={b.tone}
                href={b.href}
              />
            ))}
            {day.nowTopPx !== undefined && day.nowLabel ? (
              <CalendarNowLine top={day.nowTopPx} label={day.nowLabel} />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export { CalendarGrid };
export type { CalendarGridProps };
