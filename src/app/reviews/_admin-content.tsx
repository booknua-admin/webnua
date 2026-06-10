'use client';

import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewClientCard } from '@/components/shared/reviews/ReviewClientCard';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useAdminReviews } from '@/lib/reviews/queries';

/**
 * Operator agency-mode reviews roster — one card per accessible client
 * (`empty` for clients with no reviews yet) + a 4-up workspace stat row.
 *
 * The sidebar `AdminClientPicker` is canonical for narrowing scope; the
 * in-page `ClientMultiSelect` was dropped (Phase 9b · Session 2). When an
 * operator drills into a client, the `/reviews` dispatcher hands off to
 * `_sub-account-content.tsx` instead.
 */
function AdminReviewsContent() {
  const { data: page, isLoading, error } = useAdminReviews();

  const clientCards = page?.clientCards ?? [];

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Reviews" />
        }
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <PageSkeleton />
        ) : error || !page ? (
          <ReviewsNotice>
            {`// ${error ? normalizeError(error).message : 'Reviews unavailable'}`}
          </ReviewsNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={page.hero.eyebrow}
              title={page.hero.title}
              subtitle={page.hero.subtitle}
            />

            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              {page.stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  trend={stat.trend}
                  trendTone={stat.trendTone}
                />
              ))}
            </div>

            {clientCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                {'// No clients yet'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {clientCards.map((card) => (
                  <ReviewClientCard key={card.id} card={card} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ReviewsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-rule bg-card px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { AdminReviewsContent };
