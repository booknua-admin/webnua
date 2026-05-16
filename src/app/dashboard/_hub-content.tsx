import Link from 'next/link';

import { CalendarTodayPanel } from '@/components/admin/calendar/CalendarTodayPanel';
import { ClientHubHero } from '@/components/admin/hub/ClientHubHero';
import { FunnelConversionBars } from '@/components/shared/funnels/FunnelConversionBars';
import { HubInsightBand } from '@/components/admin/hub/HubInsightBand';
import { OperatorActionBar } from '@/components/admin/hub/OperatorActionBar';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import type { ActivityRowData, ActivityTone } from '@/components/shared/ActivityRow';
import { MiniTrendBars } from '@/components/shared/MiniTrendBars';
import { RailCard } from '@/components/shared/RailCard';
import { GlobalSearchInput } from '@/components/shared/search/GlobalSearchInput';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { freshhomeHub } from '@/lib/dashboard/client-hub';
import type { HubActivityKind, HubContextCard, HubWeeklyStat } from '@/lib/dashboard/hub-types';

// kind → presentation. The activity data stays presentation-free (vision §7);
// the mapping to ActivityFeed's colour-keyed tones lives here, at the consumer.
const ACTIVITY_PRESENTATION: Record<HubActivityKind, { icon: string; tone: ActivityTone }> = {
  review: { icon: '★', tone: 'amber' },
  lead: { icon: '✉', tone: 'info' },
  'auto-reply': { icon: '⤿', tone: 'rust' },
  'review-request': { icon: '★', tone: 'good' },
};

const DELTA_ARROW: Record<HubWeeklyStat['delta']['direction'], string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

function ContextCard({ card }: { card: HubContextCard }) {
  return (
    <RailCard heading={card.label}>
      <div className="flex flex-col gap-2">
        <div className="text-[14px] font-bold text-ink">{card.headline}</div>
        <p className="text-[12px] leading-[1.6] text-ink-quiet">{card.facts.join(' · ')}</p>
        <Link
          href={card.link.href}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.07em] text-rust transition-colors hover:text-rust-deep"
        >
          {card.link.label}
        </Link>
      </div>
    </RailCard>
  );
}

function ClientHubContent() {
  const hub = freshhomeHub;

  const activityItems: ActivityRowData[] = hub.recentActivity.map((event) => ({
    id: event.id,
    icon: ACTIVITY_PRESENTATION[event.kind].icon,
    tone: ACTIVITY_PRESENTATION[event.kind].tone,
    actor: event.actor,
    body: event.body,
    detail: event.detail,
    time: event.time,
  }));

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Clients']} current={hub.hero.clientName} />}
        search={<GlobalSearchInput />}
      />
      <div className="flex flex-col gap-7 px-10 py-10">
        <WorkspaceContextBanner />

        <OperatorActionBar actions={hub.operatorActions} />

        <ClientHubHero hero={hub.hero} />

        <div className="grid grid-cols-3 gap-3.5">
          {hub.contextCards.map((card) => (
            <ContextCard key={card.kind} card={card} />
          ))}
        </div>

        <div className="grid grid-cols-2 items-start gap-3.5">
          <CalendarTodayPanel
            panel={hub.schedule}
            hideClientLogo
            action={
              <Link
                href="/calendar"
                className="font-mono text-[11px] font-bold uppercase tracking-[0.07em] text-rust transition-colors hover:text-rust-deep"
              >
                Open calendar →
              </Link>
            }
          />
          <ActivityFeed
            title="Recent activity"
            action={
              <Link
                href="/leads"
                className="font-mono text-[11px] font-bold uppercase tracking-[0.07em] text-rust transition-colors hover:text-rust-deep"
              >
                All →
              </Link>
            }
            items={activityItems}
          />
        </div>

        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">
              {hub.hero.clientName} this week · vs prior weeks
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
              {`Day ${hub.hero.liveDayCount} of live · ${hub.funnel.periodLabel}`}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3.5">
            {hub.weeklyStats.map((stat) => (
              <StatCard
                key={stat.kind}
                label={stat.label}
                value={stat.value}
                trend={`${DELTA_ARROW[stat.delta.direction]} ${stat.delta.label}`}
                trendTone={stat.delta.direction === 'up' ? 'good' : 'quiet'}
                chart={<MiniTrendBars data={stat.trend} />}
              />
            ))}
          </div>
        </section>

        <FunnelConversionBars funnel={hub.funnel} />

        <HubInsightBand
          insight={hub.insight}
          cta={{ label: 'View full analytics →', href: '/campaigns' }}
        />
      </div>
    </>
  );
}

export { ClientHubContent };
