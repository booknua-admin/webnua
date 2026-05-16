import Link from 'next/link';

import { ClientDashboardHero } from '@/components/client/dashboard/ClientDashboardHero';
import { DashboardQueueCard } from '@/components/client/dashboard/DashboardQueueCard';
import { FunnelSummaryBand } from '@/components/client/dashboard/FunnelSummaryBand';
import { LandingSnapshotCard } from '@/components/client/dashboard/LandingSnapshotCard';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import type { ActivityRowData, ActivityTone } from '@/components/shared/ActivityRow';
import { FunnelConversionBars } from '@/components/shared/funnels/FunnelConversionBars';
import { MiniTrendBars } from '@/components/shared/MiniTrendBars';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { voltlineDashboard } from '@/lib/dashboard/client-dashboard';
import type { HubActivityKind, HubWeeklyStat } from '@/lib/dashboard/hub-types';

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

export function ClientDashboardContent() {
  const dash = voltlineDashboard;

  const activityItems: ActivityRowData[] = dash.recentActivity.map((event) => ({
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
      <Topbar breadcrumb={<TopbarBreadcrumb current="Home" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          className="mb-0"
          eyebrow={dash.greeting.tag}
          title={
            <>
              Morning, {dash.greeting.ownerName} <em>—</em>
            </>
          }
        />

        <ClientDashboardHero hero={dash.urgentHero} />

        <div className="grid grid-cols-2 items-start gap-3.5">
          <DashboardQueueCard queue={dash.followUps} />
          <DashboardQueueCard queue={dash.todaysJobs} />
        </div>

        <section className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust">
              This <em>week</em> · vs prior week
            </h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
              {dash.weeklyMeta}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3.5">
            {dash.weeklyStats.map((stat) => (
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

        <div className="flex flex-col gap-3.5">
          <FunnelConversionBars funnel={dash.funnel} />
          <FunnelSummaryBand summary={dash.funnelSummary} />
        </div>

        <LandingSnapshotCard snapshot={dash.landingSnapshot} />

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
    </>
  );
}
