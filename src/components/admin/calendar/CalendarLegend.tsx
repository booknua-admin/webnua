import { cn } from '@/lib/utils';
import type {
  CalendarClientTone,
  CalendarLegendItem,
} from '@/lib/calendar/types';

type CalendarLegendProps = {
  items: CalendarLegendItem[];
  meta?: React.ReactNode;
  className?: string;
};

const TONE_BG: Record<CalendarClientTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#4a7ba6]',
  keyhero: 'bg-[#8a5cb8]',
  neatworks: 'bg-[#2d8a4e]',
  generic: 'bg-ink',
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
            className={cn('h-3 w-3 rounded-[3px]', TONE_BG[item.tone])}
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
