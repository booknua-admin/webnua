import Link from 'next/link';

import { ClientListRow } from '@/components/admin/ClientListRow';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { allClients, clientsPageHeader } from '@/lib/dashboard/admin-dashboard';

export default function AdminClientsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Clients" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          eyebrow={clientsPageHeader.eyebrow}
          title={clientsPageHeader.title}
          subtitle={clientsPageHeader.subtitle}
        />

        <div className="flex items-center justify-between">
          <Eyebrow tone="quiet">{`// All clients · ${allClients.length}`}</Eyebrow>
          <Button variant="secondary" asChild>
            <Link href="/clients/new">+ Add new client</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-2.5">
          {allClients.map((client) => (
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
