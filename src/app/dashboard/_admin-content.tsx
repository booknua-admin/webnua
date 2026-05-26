'use client';

import { AgencyUrgentBanner } from '@/components/admin/dashboard/AgencyUrgentBanner';
import { AttentionPanelCard } from '@/components/admin/dashboard/AttentionPanelCard';
import { ClientPerformanceCard } from '@/components/admin/dashboard/ClientPerformanceCard';
import { ReviewRequestsPanel } from '@/components/admin/dashboard/ReviewRequestsPanel';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Eyebrow } from '@/components/ui/eyebrow';
import { useAdminDashboard } from '@/lib/dashboard/queries';
import { normalizeError } from '@/lib/errors';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

function DashboardNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

/** Static placeholder — new-client prospecting is the deferred Proof Page
 *  tool, which has no data layer yet. */
function AcquisitionPipelinePlaceholder() {
  return (
    <div className="rounded-xl border border-rule bg-card px-6 py-5.5">
      <div className="mb-1.5 text-[16px] font-extrabold tracking-[-0.015em] text-ink">
        Acquisition pipeline
      </div>
      <p className="mb-4 text-[13px] leading-[1.5] text-ink-quiet">
        New-client prospecting lives in the Proof Page tool.
      </p>
      <div className="rounded-lg border border-dashed border-rule bg-paper px-5 py-10 text-center font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {'// Arrives with the prospecting tool'}
      </div>
    </div>
  );
}

export function AdminDashboardContent() {
  const { data, isLoading, error } = useAdminDashboard();
  const { setActiveClientId } = useWorkspace();

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Dashboard" />} />
      <div className="flex flex-col gap-7 px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <DashboardNotice>{'// Loading agency overview…'}</DashboardNotice>
        ) : error || !data ? (
          <DashboardNotice>
            {`// ${error ? normalizeError(error).message : 'Dashboard unavailable'}`}
          </DashboardNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={data.greeting.tag}
              title={
                <>
                  {data.greeting.word}, {data.greeting.operatorName}{' '}
                  <span className="text-rust">—</span>
                </>
              }
              subtitle={data.greeting.subtitle}
            />

            {data.urgent ? <AgencyUrgentBanner {...data.urgent} /> : null}

            <ReviewRequestsPanel />

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
              <AttentionPanelCard panel={data.panels.cashflow} />
              <AttentionPanelCard panel={data.panels.onboarding} />
              <AttentionPanelCard panel={data.panels.support} />
            </div>

            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              {data.stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  trend={stat.trend}
                  trendTone={stat.trendTone}
                />
              ))}
            </div>

            <section className="flex flex-col gap-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">
                  Client performance · this week
                </h2>
                <Eyebrow tone="quiet">{'// Click a client to drill in'}</Eyebrow>
              </div>
              {data.clientPerformance.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                    {'// No clients yet'}
                  </p>
                  <h3 className="text-lg font-semibold text-ink">
                    Set up your first client to see them here.
                  </h3>
                  <p className="max-w-md text-sm text-ink-quiet">
                    Use{' '}
                    <strong className="font-semibold text-ink">
                      + Add new client
                    </strong>{' '}
                    in the sidebar to spin up a workspace — generate a site
                    + funnel, wire up integrations, and start tracking
                    leads.
                  </p>
                </div>
              ) : (
                <div className="-mx-1 flex gap-3.5 overflow-x-auto px-1 pb-2">
                  {data.clientPerformance.map((card) => (
                    <ClientPerformanceCard
                      key={card.slug}
                      card={card}
                      onSelect={setActiveClientId}
                    />
                  ))}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1.6fr_1fr]">
              <ActivityFeed
                title="Recent activity · all clients"
                items={data.recentActivity}
              />
              <AcquisitionPipelinePlaceholder />
            </div>
          </>
        )}
      </div>
    </>
  );
}
