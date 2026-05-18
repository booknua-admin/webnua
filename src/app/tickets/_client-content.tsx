'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import { TicketsHero } from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { normalizeError } from '@/lib/errors';
import {
  clientTicketTabs,
  clientTicketsHero,
  type ClientTicketRow,
} from '@/lib/tickets/client-tickets';
import { useClientTicketsInbox } from '@/lib/tickets/queries';

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
  const { data: tickets, isLoading, error } = useClientTicketsInbox();

  const allTickets = useMemo(() => tickets ?? [], [tickets]);

  const tabs = useMemo(
    () =>
      clientTicketTabs.map((tab) => ({
        ...tab,
        count: allTickets.filter((t) => matchesTab(t, tab.id)).length,
      })),
    [allTickets],
  );

  const visibleTickets = useMemo(
    () => allTickets.filter((t) => matchesTab(t, activeTab)),
    [allTickets, activeTab],
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
          {isLoading ? (
            <InboxNotice>{'// Loading tickets…'}</InboxNotice>
          ) : error ? (
            <InboxNotice>{`// ${normalizeError(error).message}`}</InboxNotice>
          ) : visibleTickets.length === 0 ? (
            <InboxNotice>{'// No tickets in this view'}</InboxNotice>
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

function InboxNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { ClientTicketsContent };
