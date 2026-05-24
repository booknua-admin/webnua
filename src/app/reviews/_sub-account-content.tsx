'use client';

import { GbpConnectPanel } from '@/components/shared/gbp/GbpConnectPanel';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewCallout } from '@/components/shared/reviews/ReviewCallout';
import { ReviewDistributionBars } from '@/components/shared/reviews/ReviewDistributionBars';
import { ReviewItem } from '@/components/shared/reviews/ReviewItem';
import { ReviewSummaryHeader } from '@/components/shared/reviews/ReviewSummaryHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useClientGbpLocation } from '@/lib/integrations/gbp/use-gbp';
import { useSubAccountReviews } from '@/lib/reviews/queries';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

/**
 * Operator-in-sub-account reviews view — drilled into one client.
 *
 * Mirrors the client deep-dive shape (`ReviewSummaryHeader` +
 * `ReviewDistributionBars` + `ReviewCallout` + the reviews list with inline
 * reply UI) fed by the operator's reviews query filtered to the active
 * client. Operator reply UI is the SAME `ReviewItem` the client uses — the
 * inline composer is keyed on `review.clientId`, so passing the per-card id
 * dispatches the reply through `useReplyToGbpReview` for that tenant.
 *
 * Adds a 4-up operator stats row (avg rating · total · new-30d · response
 * rate) above the deep-dive — the page-level mirror of the
 * stats-cards-per-flow pattern (see reference/client-context-pattern.md §6).
 *
 * GBP "Sync now" / "Change location" affordances are NOT mounted here —
 * they live on `/settings/integrations` (the connection-management surface).
 * No `ClientMultiSelect`, no `WorkspaceContextBanner` (hero carries the
 * client name).
 */
function SubAccountReviewsContent() {
  const activeClient = useActiveClient();
  const { activeClientId } = useWorkspace();
  const { data: page, isLoading, error } = useSubAccountReviews(activeClientId);
  const gbpLocation = useClientGbpLocation(page?.clientId ?? null);
  const gbpConnected = gbpLocation.data != null;

  const clientName = activeClient?.name ?? 'this client';

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={[clientName]} current="Reviews" />}
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <ReviewsNotice>{'// Loading reviews…'}</ReviewsNotice>
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

            {!gbpConnected ? (
              // No GBP location yet — show the connect CTA and hide the
              // summary / distribution / reviews list (all would be empty
              // or misleading until the integration is wired up).
              <GbpConnectPanel clientId={page.clientId} />
            ) : (
              <>
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
                        <ReviewItem
                          key={review.id}
                          review={review}
                          variant="full"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
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

export { SubAccountReviewsContent };
