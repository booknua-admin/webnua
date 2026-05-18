'use client';

import Link from 'next/link';

import { ClientListRow } from '@/components/admin/ClientListRow';
import { ContinueSetupHero } from '@/components/admin/ContinueSetupHero';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { useAdminDashboard } from '@/lib/dashboard/queries';
import { normalizeError } from '@/lib/errors';

function DashboardNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export function AdminDashboardContent() {
  const { data, isLoading, error } = useAdminDashboard();

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Dashboard" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        {isLoading ? (
          <DashboardNotice>{'// Loading clients…'}</DashboardNotice>
        ) : error || !data ? (
          <DashboardNotice>
            {`// ${error ? normalizeError(error).message : 'Dashboard unavailable'}`}
          </DashboardNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={data.greetingEyebrow}
              title={
                <>
                  Your <em>clients</em>.
                </>
              }
              subtitle={
                <>
                  Welcome back.{' '}
                  <strong>
                    {data.midSetupClient
                      ? 'One client mid-setup'
                      : 'All clients live'}
                  </strong>{' '}
                  — {data.liveClients.length} live and shipping leads.
                </>
              }
            />

            <div className="grid grid-cols-4 gap-3.5">
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

            {data.midSetupClient ? (
              <ContinueSetupHero
                tag={data.midSetupClient.tag}
                title={
                  <>
                    Continue setting up{' '}
                    <em>{data.midSetupClient.businessName}</em>.
                  </>
                }
                description={data.midSetupClient.description}
                meta={[
                  <strong key="step">{data.midSetupClient.stepLabel}</strong>,
                  <span key="owner">
                    {data.midSetupClient.ownerName}
                    {data.midSetupClient.ownerPhone
                      ? ` · ${data.midSetupClient.ownerPhone}`
                      : ''}
                  </span>,
                  data.midSetupClient.website,
                ]}
                ctaLabel="Continue setup →"
                ctaHref={data.midSetupClient.continueHref}
              />
            ) : null}

            <div className="mt-2 flex items-center justify-between">
              <Eyebrow tone="quiet">{'// Live clients'}</Eyebrow>
              <Button variant="secondary" asChild>
                <Link href="/clients/new">+ Add new client</Link>
              </Button>
            </div>

            <div className="flex flex-col gap-2.5">
              {data.liveClients.length === 0 ? (
                <DashboardNotice>{'// No live clients yet'}</DashboardNotice>
              ) : (
                data.liveClients.map((client) => (
                  <ClientListRow
                    key={client.id}
                    id={client.id}
                    initial={client.initial}
                    name={client.name}
                    meta={client.meta}
                    status={client.status}
                    leadsPerWeek={client.leadsPerWeek}
                    spend={client.spend}
                    href={client.href}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
