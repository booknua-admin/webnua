import { cn } from '@/lib/utils';
import type { CalendarClientTone } from '@/lib/calendar/types';

type AdminBookingHeroProps = {
  /** Border-left tint matches the calendar client tone */
  tone: CalendarClientTone;
  /** "Wed May 13 · <strong>9:00 — 11:00 AM</strong> · 2 hours" */
  timeRow: React.ReactNode;
  jobTitle: string;
  customer: {
    name: string;
    phone: string;
    suburb: string;
    /** Right-aligned mono pill, e.g. "FreshHome" */
    clientPill: string;
  };
  /** Button row — `<Button>` instances supplied by the caller */
  actions: React.ReactNode;
  className?: string;
};

const TONE_BORDER: Record<CalendarClientTone, string> = {
  voltline: 'border-l-rust',
  freshhome: 'border-l-[#4a7ba6]',
  keyhero: 'border-l-[#8a5cb8]',
  neatworks: 'border-l-[#2d8a4e]',
  generic: 'border-l-ink',
};

function AdminBookingHero({
  tone,
  timeRow,
  jobTitle,
  customer,
  actions,
  className,
}: AdminBookingHeroProps) {
  return (
    <div
      data-slot="admin-booking-hero"
      className={cn(
        'rounded-[12px] border border-rule border-l-[6px] bg-card px-7.5 py-6.5',
        TONE_BORDER[tone],
        className,
      )}
    >
      <div className="mb-2 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-ink-quiet [&_strong]:text-ink">
        {timeRow}
      </div>
      <div className="mb-2 text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink">
        {jobTitle}
      </div>
      <div className="mb-4 flex flex-wrap items-baseline gap-3.5 text-[14px] text-ink-soft">
        <span>
          <strong className="font-bold text-ink">{customer.name}</strong>
        </span>
        <span>·</span>
        <span>{customer.phone}</span>
        <span>·</span>
        <span>{customer.suburb}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rust-soft px-2.5 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-rust">
          {customer.clientPill}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export { AdminBookingHero };
export type { AdminBookingHeroProps };
