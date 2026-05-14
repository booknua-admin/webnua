import Link from 'next/link';

import { ClientListRow } from '@/components/admin/ClientListRow';
import { ContinueSetupHero } from '@/components/admin/ContinueSetupHero';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import {
  dashboardGreeting,
  dashboardStats,
  liveClients,
  midSetupClient,
} from '@/lib/dashboard/admin-dashboard';

export default function AdminClientsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Clients" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          eyebrow={dashboardGreeting.eyebrow}
          title={
            <>
              Your <em>clients</em>.
            </>
          }
          subtitle={
            <>
              Welcome back, Craig. <strong>One client mid-setup</strong> —
              Voltline is ready for the next step. The other three are live and
              shipping leads.
            </>
          }
        />

        <div className="grid grid-cols-4 gap-3.5">
          {dashboardStats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              trend={stat.trend}
              trendTone={stat.trendTone}
            />
          ))}
        </div>

        <ContinueSetupHero
          tag={midSetupClient.tag}
          title={
            <>
              Continue setting up <em>{midSetupClient.businessName}</em>.
            </>
          }
          description={midSetupClient.description}
          meta={[
            <strong key="step">{midSetupClient.stepLabel}</strong>,
            <span key="owner">
              {midSetupClient.ownerName} · {midSetupClient.ownerPhone}
            </span>,
            midSetupClient.website,
          ]}
          ctaLabel="Continue setup →"
          ctaHref={midSetupClient.continueHref}
        />

        <div className="mt-2 flex items-center justify-between">
          <Eyebrow tone="quiet">{'// Live clients'}</Eyebrow>
          <Button variant="secondary" asChild>
            <Link href="#">+ Add new client</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-2.5">
          {liveClients.map((client) => (
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
          ))}
        </div>
      </div>
    </>
  );
}
