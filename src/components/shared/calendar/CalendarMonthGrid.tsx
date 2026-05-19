import type { CalendarMonth, CalendarMonthDay } from '@/lib/calendar/types';
import { CLIENT_TONE_BG } from '@/lib/clients/tones';
import { cn } from '@/lib/utils';

// =============================================================================
// CalendarMonthGrid — the month-overview view. A 7-column date grid; each cell
// shows the day number, booking count and up to four client-tone dots.
// Clicking a day drills into that day's column view.
// =============================================================================

type CalendarMonthGridProps = {
  month: CalendarMonth;
  onSelectDay: (iso: string) => void;
  className?: string;
};

function CalendarMonthGrid({
  month,
  onSelectDay,
  className,
}: CalendarMonthGridProps) {
  return (
    <div
      data-slot="calendar-month-grid"
      className={cn(
        'overflow-hidden rounded-[10px] border border-rule bg-card',
        className,
      )}
    >
      <div className="grid grid-cols-7 border-b border-rule bg-paper-2">
        {month.weekdayLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-2.5 text-center font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet"
          >
            {label}
          </div>
        ))}
      </div>
      {month.weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day) => (
            <DayCell
              key={day.iso}
              day={day}
              onSelect={() => onSelectDay(day.iso)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function DayCell({
  day,
  onSelect,
}: {
  day: CalendarMonthDay;
  onSelect: () => void;
}) {
  const dots = day.bookings.slice(0, 4);
  const extra = day.bookings.length - dots.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex min-h-[104px] flex-col gap-1.5 border-b border-r border-rule-soft p-2 text-left transition-colors hover:bg-paper-2',
        !day.inMonth && 'bg-paper/50',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold',
            day.isToday
              ? 'bg-rust text-paper'
              : day.inMonth
                ? 'text-ink'
                : 'text-ink-quiet',
          )}
        >
          {day.num}
        </span>
        {day.bookings.length > 0 ? (
          <span className="font-mono text-[10px] font-bold text-ink-quiet">
            {day.bookings.length}
          </span>
        ) : null}
      </div>
      {day.bookings.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {dots.map((b) => (
            <span
              key={b.id}
              className={cn('h-2 w-2 rounded-full', CLIENT_TONE_BG[b.tone])}
            />
          ))}
          {extra > 0 ? (
            <span className="font-mono text-[9px] font-bold text-ink-quiet">
              +{extra}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}

export { CalendarMonthGrid };
export type { CalendarMonthGridProps };
