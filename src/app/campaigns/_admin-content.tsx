'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { CampaignClientRow } from '@/components/admin/campaigns/CampaignClientRow';
import { ClientMultiSelect } from '@/components/shared/ClientMultiSelect';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { normalizeError } from '@/lib/errors';
import { useAdminCampaigns } from '@/lib/campaigns/queries';

function AdminCampaignsContent() {
  const { data: page, isLoading, error } = useAdminCampaigns();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const rows = useMemo(() => page?.rows ?? [], [page]);

  // Per-client campaign counts, keyed on client slug — shown in the dropdown.
  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.clientId] = (counts[row.clientId] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      selectedClients.length === 0
        ? rows
        : rows.filter((row) => selectedClients.includes(row.clientId)),
    [selectedClients, rows],
  );

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Campaigns" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
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

            <ClientMultiSelect
              label="// CLIENT"
              value={selectedClients}
              onChange={setSelectedClients}
              counts={clientCounts}
            />

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

            <div className="flex flex-col gap-2.5">
              {visibleRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// No campaigns for this client'}
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
