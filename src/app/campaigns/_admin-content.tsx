import Link from 'next/link';

import { CampaignClientRow } from '@/components/admin/campaigns/CampaignClientRow';
import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { adminCampaigns } from '@/lib/campaigns/admin-campaigns';

function AdminCampaignsContent() {
  const { hero, filters, defaultFilterId, stats, rows, footer } =
    adminCampaigns;
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Campaigns" />
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

        <div className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <CampaignClientRow key={row.id} row={row} />
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3.5 rounded-[10px] bg-paper-2 px-5.5 py-4">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
            {footer.tag}
          </div>
          <div className="flex-1 text-[14px] text-ink-soft">{footer.body}</div>
          <Button asChild variant="secondary" className="h-9">
            <Link href={footer.ctaHref}>{footer.ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export { AdminCampaignsContent };
