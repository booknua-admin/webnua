import { cn } from '@/lib/utils';

type CalendarNowLineProps = {
  /** px offset from top of day column */
  top: number;
  /** "NOW · 10:35" */
  label: string;
  className?: string;
};

function CalendarNowLine({ top, label, className }: CalendarNowLineProps) {
  return (
    <div
      data-slot="calendar-now-line"
      className={cn(
        'pointer-events-none absolute left-0 right-0 z-[5] h-[2px] bg-rust',
        // dot on the leading edge
        'before:absolute before:left-[-6px] before:top-[-4px] before:h-2.5 before:w-2.5 before:rounded-full before:bg-rust before:content-[""]',
        className,
      )}
      style={{ top: `${top}px` }}
    >
      <span className="absolute right-1 top-[-16px] rounded-full bg-rust px-1.5 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-paper">
        {label}
      </span>
    </div>
  );
}

export { CalendarNowLine };
export type { CalendarNowLineProps };
