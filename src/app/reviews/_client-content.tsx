import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewCallout } from '@/components/shared/reviews/ReviewCallout';
import { ReviewDistributionBars } from '@/components/shared/reviews/ReviewDistributionBars';
import { ReviewItem } from '@/components/shared/reviews/ReviewItem';
import { ReviewSummaryHeader } from '@/components/shared/reviews/ReviewSummaryHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { voltlineClientReviews } from '@/lib/reviews/client-reviews';

function ClientReviewsContent() {
  const { hero, summary, distribution, callout, listHeader, listAside, reviews } =
    voltlineClientReviews;
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Reviews" />}
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />

        <div className="grid grid-cols-[200px_1fr_240px] items-center gap-7 rounded-xl border border-rule bg-card px-7 py-6">
          <div className="border-r border-paper-2 pr-7">
            <ReviewSummaryHeader
              rating={summary.rating}
              starsLabel={summary.starsLabel}
              meta={summary.meta}
              size="lg"
            />
          </div>
          <ReviewDistributionBars rows={distribution} />
          <ReviewCallout
            headline={callout.headline}
            sub={callout.sub}
            link={callout.link}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-rule bg-card">
          <div className="flex items-center justify-between border-b border-rule bg-paper-2 px-5.5 py-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet [&_strong]:text-ink">
            <span>{listHeader}</span>
            <span>{listAside}</span>
          </div>
          <div>
            {reviews.map((review) => (
              <ReviewItem key={review.id} review={review} variant="full" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export { ClientReviewsContent };
