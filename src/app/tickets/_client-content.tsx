import Link from 'next/link';

import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import { TicketsHero } from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  clientTickets,
  clientTicketTabs,
  clientTicketsHero,
} from '@/lib/tickets/client-tickets';

function ClientTicketsContent() {
  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Tickets" />}
      />
      <div className="flex flex-col gap-[18px] px-10 py-10">
        <TicketsHero
          tag={clientTicketsHero.tag}
          title={clientTicketsHero.title}
          subtitle={clientTicketsHero.subtitle}
          right={
            <Button asChild className="bg-rust text-paper hover:bg-rust-light">
              <Link href="/tickets/new">+ New ticket</Link>
            </Button>
          }
        />

        <TicketTabsBar tabs={clientTicketTabs} defaultActiveId="active" />

        <div className="overflow-hidden rounded-[14px] border border-ink/8 bg-card">
          {clientTickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              variant="client"
              title={ticket.title}
              preview={ticket.preview}
              category={ticket.category}
              status={ticket.status}
              awaiting={ticket.awaiting}
              age={ticket.age}
              href={ticket.href}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export { ClientTicketsContent };
