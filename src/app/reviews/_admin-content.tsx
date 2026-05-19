'use client';

import { useMemo, useState } from 'react';

import { ClientMultiSelect } from '@/components/shared/ClientMultiSelect';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewClientCard } from '@/components/shared/reviews/ReviewClientCard';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { normalizeError } from '@/lib/errors';
import { useAdminReviews } from '@/lib/reviews/queries';
import { useIsAgencyMode, useWorkspace } from '@/lib/workspace/workspace-stub';

function AdminReviewsContent() {
  const { data: page, isLoading, error } = useAdminReviews();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const clientCards = useMemo(() => page?.clientCards ?? [], [page]);

  // Workspace context: agency mode → cross-client roster + the multi-select
  // filter; sub-account mode → the page scopes to the picked client.
  const isAgency = useIsAgencyMode();
  const { activeClientId } = useWorkspace();
  const effectiveClients = useMemo(
    () => (isAgency || !activeClientId ? selectedClients : [activeClientId]),
    [isAgency, activeClientId, selectedClients],
  );

  // Each client card's `id` is the client slug.
  const visibleCards = useMemo(
    () =>
      effectiveClients.length === 0
        ? clientCards
        : clientCards.filter((card) => effectiveClients.includes(card.id)),
    [effectiveClients, clientCards],
  );

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Reviews" />
        }
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
            <PageHeader
              eyebrow={page.hero.eyebrow}
              title={page.hero.title}
              subtitle={page.hero.subtitle}
            />

            {isAgency ? (
              <ClientMultiSelect
                label="// CLIENT"
                value={selectedClients}
                onChange={setSelectedClients}
              />
            ) : (
              <WorkspaceContextBanner />
            )}

            <div className="grid grid-cols-4 gap-3.5">
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

            {visibleCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                {'// No reviews for this client'}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {visibleCards.map((card) => (
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
