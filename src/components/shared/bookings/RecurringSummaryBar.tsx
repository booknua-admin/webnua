import Link from 'next/link';

import { cn } from '@/lib/utils';

type RecurringSummaryBarProps = {
  /** "Fortnightly · Thursdays · 10am-12pm" — `<strong>` = paper-bold */
  summary: React.ReactNode;
  /** "26 visits per year" — secondary line, paper/70 */
  summaryDetail: string;
  /** "$4,680 / year recurring revenue" — rendered large in rust-light */
  totalLabel: string;
  ctaLabel: string;
  ctaHref?: string;
  onCta?: () => void;
  className?: string;
};

function RecurringSummaryBar({
  summary,
  summaryDetail,
  totalLabel,
  ctaLabel,
  ctaHref,
  onCta,
  className,
}: RecurringSummaryBarProps) {
  const cta = ctaHref ? (
    <Link
      href={ctaHref}
      className="cursor-pointer rounded-[10px] bg-rust px-6 py-3.5 text-[14px] font-extrabold text-paper transition-colors hover:bg-rust-deep"
    >
      {ctaLabel}
    </Link>
  ) : (
    <button
      type="button"
      onClick={onCta}
      className="cursor-pointer rounded-[10px] bg-rust px-6 py-3.5 text-[14px] font-extrabold text-paper transition-colors hover:bg-rust-deep"
    >
      {ctaLabel}
    </button>
  );

  return (
    <div
      data-slot="recurring-summary-bar"
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-4.5 rounded-[12px] bg-ink px-6.5 py-5.5 text-paper',
        className,
      )}
    >
      <div className="text-[14px] leading-[1.5] text-paper/70 [&_strong]:font-semibold [&_strong]:text-paper">
        {summary} · {summaryDetail}
        <span className="mt-1 block text-[22px] font-extrabold tracking-[-0.02em] text-rust-light">
          {totalLabel}
        </span>
      </div>
      {cta}
    </div>
  );
}

export { RecurringSummaryBar };
export type { RecurringSummaryBarProps };
