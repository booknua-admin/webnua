import { NegativeReviewAlertButton } from '@/components/admin/reviews/NegativeReviewAlertButton';
import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewClientCard } from '@/components/shared/reviews/ReviewClientCard';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { keyheroNegativeReview } from '@/lib/reviews/admin-negative-modal';
import { adminReviews } from '@/lib/reviews/admin-reviews';

function AdminReviewsContent() {
  const { hero, filters, defaultFilterId, stats, clientCards } = adminReviews;
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Reviews" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <div className="flex items-start justify-between gap-6">
          <PageHeader
            eyebrow={hero.eyebrow}
            title={hero.title}
            subtitle={hero.subtitle}
            className="mb-0"
          />
          <NegativeReviewAlertButton data={keyheroNegativeReview} />
        </div>

        <FilterChips
          label="// CLIENT"
          chips={filters}
          defaultActiveId={defaultFilterId}
        />

        <div className="grid grid-cols-4 gap-3.5">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              trend={stat.trend}
              trendTone={stat.trendTone}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {clientCards.map((card) => (
            <ReviewClientCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </>
  );
}

export { AdminReviewsContent };
