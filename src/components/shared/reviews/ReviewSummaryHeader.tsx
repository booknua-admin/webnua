import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type ReviewSummaryHeaderProps = {
  /** Inter Tight value. ReactNode so `<em>` renders rust on the star glyph. */
  rating: ReactNode;
  /** Pre-rendered stars row, e.g. "★ ★ ★ ★ ★". */
  starsLabel: string;
  /** Mono uppercase meta line. */
  meta: string;
  /** Big = client `/reviews` summary; small = admin per-client card header. */
  size?: 'lg' | 'sm';
  /** Text alignment of the inner rows. Defaults to left. */
  align?: 'left' | 'right';
  className?: string;
};

function ReviewSummaryHeader({
  rating,
  starsLabel,
  meta,
  size = 'lg',
  align = 'left',
  className,
}: ReviewSummaryHeaderProps) {
  return (
    <div
      data-slot="review-summary-header"
      data-size={size}
      className={cn(
        'flex flex-col',
        align === 'right' ? 'items-end text-right' : 'items-start text-left',
        className,
      )}
    >
      <div
        className={cn(
          'font-extrabold leading-none tracking-[-0.04em] text-ink [&_em]:not-italic [&_em]:text-rust',
          size === 'lg' ? 'mb-1 text-[56px]' : 'mb-1 text-[26px]',
        )}
      >
        {rating}
      </div>
      <div
        className={cn(
          'text-rust',
          size === 'lg' ? 'mb-1.5 text-[18px]' : 'text-[13px]',
        )}
      >
        {starsLabel}
      </div>
      <div
        className={cn(
          'font-mono font-bold uppercase tracking-[0.12em] text-ink-quiet',
          size === 'lg' ? 'text-[10px]' : 'mt-1 text-[10px]',
        )}
      >
        {meta}
      </div>
    </div>
  );
}

export { ReviewSummaryHeader };
export type { ReviewSummaryHeaderProps };
