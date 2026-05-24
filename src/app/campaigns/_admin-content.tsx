'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CampaignClientRow } from '@/components/admin/campaigns/CampaignClientRow';
import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { normalizeError } from '@/lib/errors';
import { useAdminCampaigns } from '@/lib/campaigns/queries';
import type { AdminCampaignStatus } from '@/lib/campaigns/types';

type StatusFilterId = AdminCampaignStatus | 'all';

const STATUS_FILTERS: { id: StatusFilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'pending', label: 'Pending' },
];

/**
 * Cross-client campaign roster — the operator's agency-mode view.
 *
 * Pure birds-eye: every campaign across every accessible client, with a
 * single status filter. Per-client narrowing happens via the sidebar
 * `AdminClientPicker` (drilling in routes here → `_sub-account-content`).
 *
 * Workspace context note: this body only renders in agency mode — the
 * dispatcher (`page.tsx`) routes sub-account operators to
 * `_sub-account-content`. So no `ClientMultiSelect` and no
 * `WorkspaceContextBanner` (the hero already says "All campaigns" /
 * "Workspace · campaigns").
 *
 * The `LaunchMetaCampaignButton` is intentionally NOT mounted here — launch
 * is a per-client action, so it lives on the sub-account view's operator
 * action strip. In agency mode it would be a permanently-disabled "Pick a
 * client" affordance — noise.
 */
function AdminCampaignsContent() {
  const { data: page, isLoading, error } = useAdminCampaigns();
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>('all');

  const rows = useMemo(() => page?.rows ?? [], [page]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilterId, number> = {
      all: rows.length,
      active: 0,
      paused: 0,
      pending: 0,
    };
    for (const row of rows) counts[row.status] += 1;
    return counts;
  }, [rows]);

  const chips = useMemo(
    () =>
      STATUS_FILTERS.map((f) => ({
        id: f.id,
        label: f.label,
        count: statusCounts[f.id],
      })),
    [statusCounts],
  );

  const visibleRows = useMemo(
    () =>
      statusFilter === 'all'
        ? rows
        : rows.filter((row) => row.status === statusFilter),
    [rows, statusFilter],
  );

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Campaigns" />
        }
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <CampaignsNotice>{'// Loading campaigns…'}</CampaignsNotice>
        ) : error || !page ? (
          <CampaignsNotice>
            {`// ${error ? normalizeError(error).message : 'Campaigns unavailable'}`}
          </CampaignsNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={page.hero.eyebrow}
              title={page.hero.title}
              subtitle={page.hero.subtitle}
            />

            <FilterChips
              label="// STATUS"
              chips={chips}
              value={statusFilter}
              onChange={(id) => setStatusFilter(id as StatusFilterId)}
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

            <div className="flex flex-col gap-2.5">
              {visibleRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {statusFilter === 'all'
                    ? '// No campaigns yet'
                    : `// No ${statusFilter} campaigns`}
                </div>
              ) : (
                visibleRows.map((row) => (
                  <CampaignClientRow key={row.id} row={row} />
                ))
              )}
            </div>

            <div className="mt-2 flex items-center gap-3.5 rounded-[10px] bg-paper-2 px-5.5 py-4">
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
                {page.footer.tag}
              </div>
              <div className="flex-1 text-[14px] text-ink-soft">
                {page.footer.body}
              </div>
              <Button asChild variant="secondary" className="h-9">
                <Link href={page.footer.ctaHref}>{page.footer.ctaLabel}</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function CampaignsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-rule bg-card px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { AdminCampaignsContent };
