import { CampaignActivityCard } from '@/components/shared/campaigns/CampaignActivityCard';
import { CampaignChangeCard } from '@/components/shared/campaigns/CampaignChangeCard';
import { CampaignHeroCard } from '@/components/shared/campaigns/CampaignHeroCard';
import { CampaignManagedBand } from '@/components/shared/campaigns/CampaignManagedBand';
import { CampaignTrendChart } from '@/components/shared/campaigns/CampaignTrendChart';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { voltlineClientCampaigns } from '@/lib/campaigns/client-campaigns';

function ClientCampaignsContent() {
  const { hero, managedBand, active, trend, activity, changeCard } =
    voltlineClientCampaigns;
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Campaigns" />}
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />
        <CampaignManagedBand data={managedBand} />
        <CampaignHeroCard data={active} />
        <CampaignTrendChart data={trend} />
        <CampaignActivityCard data={activity} />
        <CampaignChangeCard data={changeCard} />
      </div>
    </>
  );
}

export { ClientCampaignsContent };
