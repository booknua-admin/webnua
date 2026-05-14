import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReviewClientCardData } from '@/lib/reviews/types';

import { ReviewItem } from './ReviewItem';
import { ReviewMiniStat } from './ReviewMiniStat';
import { ReviewSummaryHeader } from './ReviewSummaryHeader';

type ReviewClientCardProps = {
  card: ReviewClientCardData;
  className?: string;
};

function ReviewClientCard({ card, className }: ReviewClientCardProps) {
  return (
    <div
      data-slot="review-client-card"
      data-state={card.kind}
      className={cn(
        'rounded-xl border border-rule bg-card px-6 py-5.5',
        card.kind === 'empty' && 'opacity-55',
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-3.5 border-b border-paper-2 pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-ink text-[16px] font-extrabold text-rust-light">
          {card.logoInitial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 text-[17px] font-extrabold leading-tight tracking-[-0.02em] text-ink">
            {card.clientName}
          </div>
          <div className="font-mono text-[11px] tracking-[0.06em] text-ink-quiet">
            {card.meta}
          </div>
        </div>
        {card.kind === 'connected' ? (
          <ReviewSummaryHeader
            rating={card.summary.rating}
            starsLabel={card.summary.starsLabel}
            meta={card.summary.meta}
            size="sm"
            align="right"
          />
        ) : (
          <div className="text-[26px] font-extrabold leading-none text-ink-quiet">
            — ★
          </div>
        )}
      </div>

      {card.kind === 'connected' ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            {card.stats.map((stat) => (
              <ReviewMiniStat
                key={stat.label}
                label={stat.label}
                value={stat.value}
              />
            ))}
          </div>
          <div className="border-t border-paper-2 pt-3.5">
            <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {card.recentLabel}
            </div>
            {card.recent.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                variant="compact"
              />
            ))}
          </div>
        </>
      ) : (
        <div className="pt-6 text-center">
          <p className="mb-3 text-[14px] text-ink-quiet">
            {card.emptyDescription}
          </p>
          <Button asChild variant="secondary" size="sm" className="text-[12px]">
            <Link href={card.cta.href}>{card.cta.label}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export { ReviewClientCard };
export type { ReviewClientCardProps };
