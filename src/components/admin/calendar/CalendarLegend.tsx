import { CALENDAR_TONE_BG } from '@/lib/calendar/tones';
import type { CalendarLegendItem } from '@/lib/calendar/types';
import { cn } from '@/lib/utils';

type CalendarLegendProps = {
  items: CalendarLegendItem[];
  meta?: React.ReactNode;
  className?: string;
};

function CalendarLegend({ items, meta, className }: CalendarLegendProps) {
  return (
    <div
      data-slot="calendar-legend"
      className={cn(
        'flex flex-wrap items-center gap-3.5 rounded-lg bg-paper-2 px-4.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet',
        className,
      )}
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn('h-3 w-3 rounded-[3px]', CALENDAR_TONE_BG[item.tone])}
          />
          {item.label}
        </span>
      ))}
      {meta ? <span className="ml-auto text-ink-quiet">{meta}</span> : null}
    </div>
  );
}

export { CalendarLegend };
export type { CalendarLegendProps };
