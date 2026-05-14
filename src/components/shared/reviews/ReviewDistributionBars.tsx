import { cn } from '@/lib/utils';
import type { ReviewDistributionRow } from '@/lib/reviews/types';

type ReviewDistributionBarsProps = {
  rows: ReviewDistributionRow[];
  className?: string;
};

function ReviewDistributionBars({
  rows,
  className,
}: ReviewDistributionBarsProps) {
  return (
    <div
      data-slot="review-distribution-bars"
      className={cn('flex flex-col gap-1.5', className)}
    >
      {rows.map((row) => (
        <div
          key={row.stars}
          className="grid grid-cols-[40px_1fr_32px] items-center gap-2.5 font-mono text-[11px] font-semibold text-ink-quiet"
        >
          <span className="text-rust">{row.stars} ★</span>
          <span className="relative h-1.5 overflow-hidden rounded-[3px] bg-paper-2">
            <span
              className="block h-full rounded-[3px] bg-rust"
              style={{ width: `${row.pct}%` }}
            />
          </span>
          <span>{row.count}</span>
        </div>
      ))}
    </div>
  );
}

export { ReviewDistributionBars };
export type { ReviewDistributionBarsProps };
