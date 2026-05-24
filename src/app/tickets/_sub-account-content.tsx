'use client';

import { useMemo, useState } from 'react';

import { FunnelApprovalRow } from '@/components/admin/funnels/FunnelApprovalRow';
import { WebsiteApprovalRow } from '@/components/admin/tickets/WebsiteApprovalRow';
import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import {
  TicketsHero,
  TicketsHeroStat,
} from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Input } from '@/components/ui/input';
import { normalizeError } from '@/lib/errors';
import { adminTicketTabs, type AdminTicketRow } from '@/lib/tickets/admin-tickets';
import { useAdminTicketsInbox } from '@/lib/tickets/queries';
import type { TicketStatus, TicketTab } from '@/lib/tickets/types';
import type { FunnelApprovalSubmission } from '@/lib/funnel/approval';
import { useAllPendingFunnelApprovals } from '@/lib/funnel/queries';
import type { WebsiteApprovalSubmission } from '@/lib/tickets/website-approval-stub';
import { useAllPendingApprovals } from '@/lib/website/use-publish-state';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

const APPROVALS_TAB_ID = 'approvals';

const TAB_STATUS: Record<string, TicketStatus | 'all'> = {
  all: 'all',
  open: 'open',
  'in-progress': 'in_progress',
  blocked: 'blocked',
  done: 'done',
};

type Row = AdminTicketRow;

function matchesTab(ticket: Row, tabId: string): boolean {
  const status = TAB_STATUS[tabId];
  return status === undefined || status === 'all' || ticket.status === status;
}

function matchesSearch(ticket: Row, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    ticket.title.toLowerCase().includes(q) ||
    ticket.preview.toLowerCase().includes(q)
  );
}

/**
 * Operator-in-sub-account ticket inbox — drilled into one client.
 *
 * Frames the tickets as "{ClientName}'s ticket inbox" (single-client view —
 * the same shape a client sees on their own inbox, no cross-client column /
 * pill / multi-select) but renders with the admin TicketRow `client` variant
 * so the operator gets the awaiting/category/status pills they need. The
 * approvals queue narrows to this client too.
 */
function SubAccountTicketsContent() {
  const activeClient = useActiveClient();
  const { activeClientId } = useWorkspace();
  const pendingApprovals = useAllPendingApprovals();
  const pendingFunnelApprovals = useAllPendingFunnelApprovals();
  const { data: tickets, isLoading, error } = useAdminTicketsInbox();

  const [activeTabId, setActiveTabId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const onApprovalsTab = activeTabId === APPROVALS_TAB_ID;

  // Narrow every list to the active client.
  const clientTickets = useMemo(
    () => (tickets ?? []).filter((t) => t.client.slug === activeClientId),
    [tickets, activeClientId],
  );

  const clientApprovals = useMemo(
    () => pendingApprovals.filter((s) => s.clientSlug === activeClientId),
    [pendingApprovals, activeClientId],
  );

  const clientFunnelApprovals = useMemo(
    () =>
      pendingFunnelApprovals.filter((s) => s.clientSlug === activeClientId),
    [pendingFunnelApprovals, activeClientId],
  );

  const tabs = useMemo<TicketTab[]>(() => {
    const withCounts = adminTicketTabs.map((tab) => ({
      ...tab,
      count: clientTickets.filter((t) => matchesTab(t, tab.id)).length,
    }));
    const approvalsTab: TicketTab = {
      id: APPROVALS_TAB_ID,
      label: 'Approvals',
      count: clientApprovals.length + clientFunnelApprovals.length,
    };
    return [withCounts[0], approvalsTab, ...withCounts.slice(1)];
  }, [clientTickets, clientApprovals.length, clientFunnelApprovals.length]);

  const visibleTickets = useMemo(
    () =>
      clientTickets
        .filter((t) => matchesTab(t, activeTabId))
        .filter((t) => matchesSearch(t, search)),
    [clientTickets, activeTabId, search],
  );

  const clientName = activeClient?.name ?? 'this client';
  const totalOpen = clientTickets.filter((t) => t.status !== 'done').length;

  return (
    <>
      <Topbar
        hideSearch
        breadcrumb={<TopbarBreadcrumb trail={[clientName]} current="Tickets" />}
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        <TicketsHero
          tag={`// ${clientName.toUpperCase()} · TICKETS`}
          title={
            <>
              Ticket <em>inbox</em>.
            </>
          }
          subtitle={
            <>
              Every request from <strong>{clientName}</strong>. Click a ticket
              to open the thread.
            </>
          }
          right={
            <>
              <TicketsHeroStat
                num={totalOpen}
                label="OPEN"
                tone={totalOpen > 0 ? 'rust' : 'neutral'}
              />
              <TicketsHeroStat
                num={clientApprovals.length + clientFunnelApprovals.length}
                label="APPROVALS"
                tone={
                  clientApprovals.length + clientFunnelApprovals.length > 0
                    ? 'warn'
                    : 'neutral'
                }
              />
            </>
          }
        />

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
          <ApprovalsList
            website={clientApprovals}
            funnel={clientFunnelApprovals}
          />
        ) : (
          <RegularTicketsList
            tickets={visibleTickets}
            isLoading={isLoading}
            error={error}
          />
        )}
      </div>
    </>
  );
}

function RegularTicketsList({
  tickets,
  isLoading,
  error,
}: {
  tickets: Row[];
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-ink/8 bg-card">
      {isLoading ? (
        <ListNotice>{'// Loading tickets…'}</ListNotice>
      ) : error ? (
        <ListNotice>{`// ${normalizeError(error).message}`}</ListNotice>
      ) : tickets.length === 0 ? (
        <ListNotice>{'// No tickets in this view'}</ListNotice>
      ) : (
        tickets.map((ticket) => (
          // Use the client variant — single-business framing, no client
          // column. The admin operator's capability comes from the user
          // role, not from the row shape.
          <TicketRow
            key={ticket.id}
            variant="client"
            title={ticket.title}
            preview={ticket.preview}
            category={ticket.category}
            status={ticket.status}
            // Best-effort: the admin row record doesn't expose awaiting,
            // but the inbox sort already surfaces unread items first.
            awaiting={null}
            age={ticket.age}
            href={ticket.href}
          />
        ))
      )}
    </div>
  );
}

function ListNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

function ApprovalsList({
  website,
  funnel,
}: {
  website: WebsiteApprovalSubmission[];
  funnel: FunnelApprovalSubmission[];
}) {
  if (website.length + funnel.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// QUEUE EMPTY'}
        </p>
        <p className="mx-auto max-w-[440px] text-[14px] text-ink-soft">
          No website or funnel changes awaiting approval from this client.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
      <div className="grid grid-cols-[36px_1fr_90px_auto] items-center gap-4 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        <div />
        <div>{'// Submission · changes'}</div>
        <div className="text-right">{'// Age'}</div>
        <div>{'// Actions'}</div>
      </div>
      {website.map((sub) => (
        <WebsiteApprovalRow key={sub.id} submission={sub} />
      ))}
      {funnel.map((sub) => (
        <FunnelApprovalRow key={sub.id} submission={sub} />
      ))}
    </div>
  );
}

export { SubAccountTicketsContent };
