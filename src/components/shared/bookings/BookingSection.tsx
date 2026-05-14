import { cn } from '@/lib/utils';

type BookingSectionProps = {
  /** Mono uppercase heading, e.g. "// JOB DETAILS" */
  heading: string;
  /** Section variant.
   *  - `card` (default, admin): standalone white card with its own border + padding.
   *  - `inline` (client): plain block separated from the next section by a paper-2
   *    bottom rule. Use when stacking sections inside an outer wrapper card. */
  variant?: 'card' | 'inline';
  children: React.ReactNode;
  className?: string;
};

function BookingSection({
  heading,
  variant = 'card',
  children,
  className,
}: BookingSectionProps) {
  const isCard = variant === 'card';
  return (
    <section
      data-slot="booking-section"
      data-variant={variant}
      className={cn(
        isCard
          ? 'rounded-[10px] border border-rule bg-card px-6.5 py-5.5'
          : 'mb-5.5 border-b border-paper-2 pb-5.5 last:mb-0 last:border-b-0 last:pb-0',
        className,
      )}
    >
      <div className="mb-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {heading}
      </div>
      {children}
    </section>
  );
}

export { BookingSection };
export type { BookingSectionProps };
