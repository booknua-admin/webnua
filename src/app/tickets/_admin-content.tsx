'use client';

import { useMemo, useState } from 'react';

import { WebsiteApprovalRow } from '@/components/admin/tickets/WebsiteApprovalRow';
import { FilterChips } from '@/components/shared/FilterChips';
import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import {
  TicketsHero,
  TicketsHeroStat,
} from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Input } from '@/components/ui/input';
import {
  adminTickets,
  adminTicketsHero,
  adminTicketTabs,
  type AdminTicketRow,
} from '@/lib/tickets/admin-tickets';
import type { TicketStatus, TicketTab } from '@/lib/tickets/types';
import { useAllPendingApprovals } from '@/lib/website/use-publish-state';

const APPROVALS_TAB_ID = 'website-approvals';

// Status-tab ids → TicketStatus. `all` matches everything.
const TAB_STATUS: Record<string, TicketStatus | 'all'> = {
  all: 'all',
  open: 'open',
  'in-progress': 'in_progress',
  blocked: 'blocked',
  done: 'done',
};

function matchesTab(ticket: AdminTicketRow, tabId: string): boolean {
  const status = TAB_STATUS[tabId];
  return status === undefined || status === 'all' || ticket.status === status;
}

function matchesSearch(ticket: AdminTicketRow, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    ticket.title.toLowerCase().includes(q) ||
    ticket.preview.toLowerCase().includes(q)
  );
}

function AdminTicketsContent() {
  const pendingApprovals = useAllPendingApprovals();

  const [activeTabId, setActiveTabId] = useState<string>('all');
  const [activeClient, setActiveClient] = useState('all');
  const [search, setSearch] = useState('');
  const onApprovalsTab = activeTabId === APPROVALS_TAB_ID;

  // Client filter chips, derived from the tickets' own clients.
  const clientChips = useMemo(() => {
    const names = new Map<string, string>();
    for (const t of adminTickets) names.set(t.client.id, t.client.name);
    return [
      { id: 'all', label: 'All clients', count: adminTickets.length },
      ...[...names].map(([id, label]) => ({
        id,
        label,
        count: adminTickets.filter((t) => t.client.id === id).length,
      })),
    ];
  }, []);

  // The client filter narrows the pool; tab counts + the visible list are
  // computed against it so the filters compose.
  const clientPool = useMemo(
    () =>
      activeClient === 'all'
        ? adminTickets
        : adminTickets.filter((t) => t.client.id === activeClient),
    [activeClient],
  );

  const tabs = useMemo<TicketTab[]>(() => {
    const withCounts = adminTicketTabs.map((tab) => ({
      ...tab,
      count: clientPool.filter((t) => matchesTab(t, tab.id)).length,
    }));
    const approvalsTab: TicketTab = {
      id: APPROVALS_TAB_ID,
      label: 'Website approvals',
      count: pendingApprovals.length,
    };
    return [withCounts[0], approvalsTab, ...withCounts.slice(1)];
  }, [clientPool, pendingApprovals.length]);

  const visibleTickets = useMemo(
    () =>
      clientPool
        .filter((t) => matchesTab(t, activeTabId))
        .filter((t) => matchesSearch(t, search)),
    [clientPool, activeTabId, search],
  );

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Tickets" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <TicketsHero
          tag={adminTicketsHero.tag}
          title={adminTicketsHero.title}
          subtitle={adminTicketsHero.subtitle}
          right={
            <>
              {adminTicketsHero.stats.map((stat) => (
                <TicketsHeroStat
                  key={stat.label}
                  num={stat.num}
                  label={stat.label}
                  tone={stat.tone}
                />
              ))}
            </>
          }
        />

        {onApprovalsTab ? null : (
          <FilterChips
            label="// CLIENT"
            chips={clientChips}
            value={activeClient}
            onChange={setActiveClient}
          />
        )}

        <div className="flex items-center justify-between gap-4">
          <TicketTabsBar
            tabs={tabs}
            value={activeTabId}
            onChange={setActiveTabId}
          />
          {onApprovalsTab ? null : (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="⌕ Search tickets"
              className="h-9 w-[220px] rounded-full"
            />
          )}
        </div>

        {onApprovalsTab ? (
          <ApprovalsList submissions={pendingApprovals} />
        ) : (
          <RegularTicketsList tickets={visibleTickets} />
        )}
      </div>
    </>
  );
}

function RegularTicketsList({ tickets }: { tickets: AdminTicketRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
      <div className="grid grid-cols-[20px_180px_1fr_110px_120px_110px_80px] items-center gap-3 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        <div />
        <div>{'// Client'}</div>
        <div>{'// Subject'}</div>
        <div>{'// Category'}</div>
        <div>{'// Status'}</div>
        <div>{'// Urgency'}</div>
        <div className="text-right">{'// Age'}</div>
      </div>
      {tickets.length === 0 ? (
        <p className="px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// No tickets in this view'}
        </p>
      ) : (
        tickets.map((ticket) => (
          <TicketRow
            key={ticket.id}
            variant="admin"
            title={ticket.title}
            preview={ticket.preview}
            category={ticket.category}
            status={ticket.status}
            urgency={ticket.urgency}
            age={ticket.age}
            unread={ticket.unread}
            client={ticket.client}
            href={ticket.href}
          />
        ))
      )}
    </div>
  );
}

function ApprovalsList({
  submissions,
}: {
  submissions: ReturnType<typeof useAllPendingApprovals>;
}) {
  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// QUEUE EMPTY'}
        </p>
        <p className="mx-auto max-w-[440px] text-[14px] text-ink-soft">
          No website changes awaiting approval. Submissions land here when a
          client editor without publish capability hits{' '}
          <strong className="text-ink">Submit for review →</strong> in the
          page editor.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
      <div className="grid grid-cols-[36px_1fr_90px_auto] items-center gap-4 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        <div />
        <div>{'// Client · changes'}</div>
        <div className="text-right">{'// Age'}</div>
        <div>{'// Actions'}</div>
      </div>
      {submissions.map((sub) => (
        <WebsiteApprovalRow key={sub.id} submission={sub} />
      ))}
    </div>
  );
}

export { AdminTicketsContent };
