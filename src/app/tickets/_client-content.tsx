'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import { TicketsHero } from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  clientTickets,
  clientTicketTabs,
  clientTicketsHero,
  type ClientTicketRow,
} from '@/lib/tickets/client-tickets';

// Client ticket tabs aren't 1:1 with TicketStatus — `active` is "anything
// not done", `needs-reply` keys off `awaiting`. One predicate per tab.
function matchesTab(ticket: ClientTicketRow, tabId: string): boolean {
  switch (tabId) {
    case 'active':
      return ticket.status !== 'done';
    case 'needs-reply':
      return ticket.awaiting === 'client';
    case 'done':
      return ticket.status === 'done';
    default:
      return true;
  }
}

function ClientTicketsContent() {
  const [activeTab, setActiveTab] = useState('active');

  const tabs = useMemo(
    () =>
      clientTicketTabs.map((tab) => ({
        ...tab,
        count: clientTickets.filter((t) => matchesTab(t, tab.id)).length,
      })),
    [],
  );

  const visibleTickets = useMemo(
    () => clientTickets.filter((t) => matchesTab(t, activeTab)),
    [activeTab],
  );

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

        <TicketTabsBar tabs={tabs} value={activeTab} onChange={setActiveTab} />

        <div className="overflow-hidden rounded-[14px] border border-ink/8 bg-card">
          {visibleTickets.length === 0 ? (
            <p className="px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {'// No tickets in this view'}
            </p>
          ) : (
            visibleTickets.map((ticket) => (
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
            ))
          )}
        </div>
      </div>
    </>
  );
}

export { ClientTicketsContent };
