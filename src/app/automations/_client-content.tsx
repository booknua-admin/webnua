import { AutomationInfoBanner } from '@/components/shared/automations/AutomationInfoBanner';
import { AutomationStatsCard } from '@/components/shared/automations/AutomationStatsCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { clientAutomations } from '@/lib/automations/client-automations';

function ClientAutomationsContent() {
  const { hero, banner, cards } = clientAutomations;
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Home']} current="Automations" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />
        <AutomationInfoBanner>{banner}</AutomationInfoBanner>
        <div className="flex flex-col gap-3.5">
          {cards.map((automation) => (
            <AutomationStatsCard key={automation.id} automation={automation} />
          ))}
        </div>
      </div>
    </>
  );
}

export { ClientAutomationsContent };
