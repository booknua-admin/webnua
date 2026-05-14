import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { CalendarClientTone } from '@/lib/calendar/types';

type BookingPillProps = {
  time: string;
  title: string;
  customer: string;
  /** px from top of the day column. 7am = 0, 1 hour = 50px */
  top: number;
  /** px height. 1 hour = 50px */
  height: number;
  /** Admin variant tints the pill per client. Client variant omits (defaults to rust). */
  tone?: CalendarClientTone;
  href?: string;
  className?: string;
};

const TONE_BG: Record<CalendarClientTone, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#4a7ba6]',
  keyhero: 'bg-[#8a5cb8]',
  neatworks: 'bg-[#2d8a4e]',
  generic: 'bg-ink',
};

function BookingPill({
  time,
  title,
  customer,
  top,
  height,
  tone,
  href,
  className,
}: BookingPillProps) {
  const toneBg = tone ? TONE_BG[tone] : 'bg-rust';
  const baseClasses = cn(
    'absolute left-1 right-1 z-[3] overflow-hidden rounded-md px-2 py-1.5 text-paper shadow-card transition-transform hover:scale-[1.02] hover:z-[6]',
    toneBg,
    className,
  );
  const style = { top: `${top}px`, height: `${height}px` };
  const body = (
    <>
      <div className="mb-0.5 font-mono text-[9px] font-semibold tracking-[0.04em] opacity-85">
        {time}
      </div>
      <div className="text-[11px] leading-[1.2] font-bold">{title}</div>
      <div className="text-[10px] leading-[1.2] font-medium opacity-90">
        {customer}
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        data-slot="booking-pill"
        className={cn(baseClasses, 'cursor-pointer')}
        style={style}
      >
        {body}
      </Link>
    );
  }
  return (
    <div
      data-slot="booking-pill"
      role="button"
      tabIndex={0}
      className={cn(baseClasses, 'cursor-pointer')}
      style={style}
    >
      {body}
    </div>
  );
}

export { BookingPill };
export type { BookingPillProps };
