'use client';

import { CampaignActivityCard } from '@/components/shared/campaigns/CampaignActivityCard';
import { CampaignChangeCard } from '@/components/shared/campaigns/CampaignChangeCard';
import { CampaignHeroCard } from '@/components/shared/campaigns/CampaignHeroCard';
import { CampaignManagedBand } from '@/components/shared/campaigns/CampaignManagedBand';
import { CampaignTrendChart } from '@/components/shared/campaigns/CampaignTrendChart';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useClientCampaigns } from '@/lib/campaigns/queries';

function ClientCampaignsContent() {
  const { data: page, isLoading, error } = useClientCampaigns();

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Campaigns" />}
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
            <CampaignManagedBand data={page.managedBand} />
            <CampaignHeroCard data={page.active} />
            {page.trend ? (
              <CampaignTrendChart data={page.trend} />
            ) : (
              <div className="rounded-xl border border-dashed border-rule bg-paper px-7 py-8 text-center">
                <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                  {'// LEADS VS SPEND · AWAITING META ADS'}
                </p>
                <p className="mx-auto max-w-[460px] text-[13px] text-ink-soft">
                  The weekly leads-vs-spend trend appears here once this
                  client&apos;s Meta ad account is connected.
                </p>
              </div>
            )}
            <CampaignActivityCard data={page.activity} />
            <CampaignChangeCard data={page.changeCard} />
          </>
        )}
      </div>
    </>
  );
}

function CampaignsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { ClientCampaignsContent };
