'use client';

import { NegativeReviewAlertButton } from '@/components/client/reviews/NegativeReviewAlertButton';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewCallout } from '@/components/shared/reviews/ReviewCallout';
import { ReviewDistributionBars } from '@/components/shared/reviews/ReviewDistributionBars';
import { ReviewItem } from '@/components/shared/reviews/ReviewItem';
import { ReviewSummaryHeader } from '@/components/shared/reviews/ReviewSummaryHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useClientReviews } from '@/lib/reviews/queries';
import { voltlineNegativeReview } from '@/lib/reviews/client-negative-modal';

function ClientReviewsContent() {
  const { data: page, isLoading, error } = useClientReviews();

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Reviews" />}
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        {isLoading ? (
          <ReviewsNotice>{'// Loading reviews…'}</ReviewsNotice>
        ) : error || !page ? (
          <ReviewsNotice>
            {`// ${error ? normalizeError(error).message : 'Reviews unavailable'}`}
          </ReviewsNotice>
        ) : (
          <>
            <div className="flex items-start justify-between gap-6">
              <PageHeader
                eyebrow={page.hero.eyebrow}
                title={page.hero.title}
                subtitle={page.hero.subtitle}
                className="mb-0"
              />
              <NegativeReviewAlertButton data={voltlineNegativeReview} />
            </div>

            <div className="grid grid-cols-[200px_1fr_240px] items-center gap-7 rounded-xl border border-rule bg-card px-7 py-6">
              <div className="border-r border-paper-2 pr-7">
                <ReviewSummaryHeader
                  rating={page.summary.rating}
                  starsLabel={page.summary.starsLabel}
                  meta={page.summary.meta}
                  size="lg"
                />
              </div>
              <ReviewDistributionBars rows={page.distribution} />
              <ReviewCallout
                headline={page.callout.headline}
                sub={page.callout.sub}
                link={page.callout.link}
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-rule bg-card">
              <div className="flex items-center justify-between border-b border-rule bg-paper-2 px-5.5 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet [&_strong]:text-ink">
                <span>{page.listHeader}</span>
                <span>{page.listAside}</span>
              </div>
              {page.reviews.length === 0 ? (
                <p className="px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// No reviews collected yet'}
                </p>
              ) : (
                <div>
                  {page.reviews.map((review) => (
                    <ReviewItem key={review.id} review={review} variant="full" />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ReviewsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { ClientReviewsContent };
