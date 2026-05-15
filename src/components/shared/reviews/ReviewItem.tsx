import { cn } from '@/lib/utils';
import type { ReviewItem as ReviewItemData } from '@/lib/reviews/types';

type ReviewItemProps = {
  review: ReviewItemData;
  /** `full` = client `/reviews` row (avatar + name+job + quote + stars + age).
   *  `compact` = admin per-client card recent-review row (strong-name + quote
   *  + right-aligned stars + age). */
  variant: 'full' | 'compact';
  className?: string;
};

function ReviewItem({ review, variant, className }: ReviewItemProps) {
  if (variant === 'full') {
    return (
      <div
        data-slot="review-item"
        data-variant="full"
        className={cn(
          'grid grid-cols-[44px_1fr_100px_80px] items-start gap-4 border-b border-paper-2 px-5.5 py-4.5 last:border-b-0',
          className,
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-2 text-[14px] font-bold text-ink">
          {review.authorInitials ?? review.authorName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-[14px] font-bold text-ink">
              {review.authorName}
            </span>
            {review.job ? (
              <span className="text-[12px] text-ink-quiet">· {review.job}</span>
            ) : null}
          </div>
          <p className="text-[13px] leading-[1.5] text-ink-soft">
            {review.text}
          </p>
        </div>
        <div className="text-left text-[14px] font-bold leading-[1.6] text-rust">
          {'★'.repeat(review.stars)}
        </div>
        <div className="text-right font-mono text-[10px] leading-[1.6] tracking-[0.04em] text-ink-quiet">
          {review.age}
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="review-item"
      data-variant="compact"
      className={cn(
        'grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-dotted border-rule py-2 last:border-b-0',
        className,
      )}
    >
      <p className="line-clamp-2 text-[12px] leading-[1.4] text-ink-soft [&_strong]:font-bold [&_strong]:text-ink">
        <strong>{review.authorName}</strong> · &ldquo;{review.text}&rdquo;
      </p>
      <div className="text-right text-[12px] font-bold text-rust">
        {'★'.repeat(review.stars)} · {review.age}
      </div>
    </div>
  );
}

export { ReviewItem };
export type { ReviewItemProps };
