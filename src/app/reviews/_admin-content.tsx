'use client';

import { useMemo, useState } from 'react';

import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewClientCard } from '@/components/shared/reviews/ReviewClientCard';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminReviews } from '@/lib/reviews/admin-reviews';

function AdminReviewsContent() {
  const { hero, filters, defaultFilterId, stats, clientCards } = adminReviews;
  const [activeClient, setActiveClient] = useState(defaultFilterId);

  // Each client card's `id` is the client id — the chip ids match 1:1.
  const clientFilters = useMemo(
    () =>
      filters.map((chip) => ({
        ...chip,
        count:
          chip.id === 'all'
            ? clientCards.length
            : clientCards.filter((card) => card.id === chip.id).length,
      })),
    [filters, clientCards],
  );

  const visibleCards = useMemo(
    () =>
      activeClient === 'all'
        ? clientCards
        : clientCards.filter((card) => card.id === activeClient),
    [activeClient, clientCards],
  );

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Reviews" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />

        <FilterChips
          label="// CLIENT"
          chips={clientFilters}
          value={activeClient}
          onChange={setActiveClient}
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
      </div>
    </>
  );
}

export { AdminReviewsContent };
