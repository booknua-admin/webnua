import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { FunnelFlow } from '@/components/client/funnels/FunnelFlow';
import { FunnelHero } from '@/components/client/funnels/FunnelHero';
import { FunnelHistoryCard } from '@/components/client/funnels/FunnelHistoryCard';
import { FunnelInsightsCard } from '@/components/client/funnels/FunnelInsightsCard';
import { voltlineFunnel } from '@/lib/funnels/client-detail';

export default function ClientFunnelDetailPage() {
  const funnel = voltlineFunnel;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Website']} current="Funnel detail" />
        }
      />
      <div className="flex flex-col gap-4 px-10 py-7">
        <FunnelHero
          back={funnel.back}
          tag={funnel.hero.tag}
          title={funnel.hero.title}
          subtitle={funnel.hero.subtitle}
          meta={funnel.hero.meta}
          versionLabel={funnel.hero.versionLabel}
          actions={funnel.hero.actions}
          agg={funnel.agg}
        />

        <FunnelFlow
          title={funnel.flow.title}
          steps={funnel.steps}
          arrows={funnel.arrows}
          periods={funnel.flow.periods}
          defaultPeriod={funnel.flow.defaultPeriod}
        />

        <div className="grid grid-cols-2 gap-3.5">
          <FunnelInsightsCard
            title={funnel.insights.title}
            subtitle={funnel.insights.subtitle}
            items={funnel.insights.items}
          />
          <FunnelHistoryCard
            title={funnel.history.title}
            subtitle={funnel.history.subtitle}
            items={funnel.history.items}
            ctaLabel={funnel.history.ctaLabel}
            ctaHref={funnel.history.ctaHref}
          />
        </div>
      </div>
    </>
  );
}
