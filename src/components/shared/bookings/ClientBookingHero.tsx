import { cn } from '@/lib/utils';

type ClientBookingHeroProps = {
  /** "// CALENDAR · WED MAY 13 · 13:00 — 15:00" */
  tag: string;
  /** "Ceiling fan + RCD <em>replacement</em>" — `<em>` renders rust-light */
  title: React.ReactNode;
  /** Inline meta line: customer / suburb / price / duration. The first segment
   *  renders ink-bold via `<strong>`; segments are separated by `·` */
  meta: {
    customer: string;
    suburb: string;
    price: string;
    duration: string;
  };
  /** "Scheduled · 2.5h away" — rust-bg paper-text dot pill on the right */
  statusLabel: string;
  className?: string;
};

function ClientBookingHero({
  tag,
  title,
  meta,
  statusLabel,
  className,
}: ClientBookingHeroProps) {
  return (
    <div
      data-slot="client-booking-hero"
      className={cn(
        'mb-4 grid grid-cols-[1fr_auto] items-center gap-6 rounded-[14px] bg-ink px-8 py-7 text-paper',
        className,
      )}
    >
      <div>
        <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust-light">
          {tag}
        </div>
        <div className="mb-2 text-[26px] font-extrabold leading-[1.1] tracking-[-0.025em] text-paper [&_em]:not-italic [&_em]:text-rust-light">
          {title}
        </div>
        <div className="flex flex-wrap gap-3 text-[14px] text-paper/70">
          <span>
            <strong className="font-semibold text-paper">{meta.customer}</strong>
          </span>
          <span>·</span>
          <span>{meta.suburb}</span>
          <span>·</span>
          <span>{meta.price}</span>
          <span>·</span>
          <span>{meta.duration}</span>
        </div>
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-full bg-rust px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-paper">
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-paper"
        />
        {statusLabel}
      </div>
    </div>
  );
}

export { ClientBookingHero };
export type { ClientBookingHeroProps };
