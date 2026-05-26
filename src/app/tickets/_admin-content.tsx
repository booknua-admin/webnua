'use client';

import { useMemo, useState } from 'react';

import { FunnelApprovalRow } from '@/components/admin/funnels/FunnelApprovalRow';
import { WebsiteApprovalRow } from '@/components/admin/tickets/WebsiteApprovalRow';
import { ClientMultiSelect } from '@/components/shared/ClientMultiSelect';
import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import {
  TicketsHero,
  TicketsHeroStat,
} from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Input } from '@/components/ui/input';
import { normalizeError } from '@/lib/errors';
import {
  adminTicketsHero,
  adminTicketTabs,
  type AdminTicketHeroStat,
  type AdminTicketRow,
} from '@/lib/tickets/admin-tickets';
import { useAdminTicketsInbox } from '@/lib/tickets/queries';
import type { TicketStatus, TicketTab } from '@/lib/tickets/types';
import type { FunnelApprovalSubmission } from '@/lib/funnel/approval';
import { useAllPendingFunnelApprovals } from '@/lib/funnel/queries';
import type { WebsiteApprovalSubmission } from '@/lib/tickets/website-approval-stub';
import { useAllPendingApprovals } from '@/lib/website/use-publish-state';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

const APPROVALS_TAB_ID = 'approvals';

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
  const pendingFunnelApprovals = useAllPendingFunnelApprovals();
  const { data: tickets, isLoading, error } = useAdminTicketsInbox();
  const { activeClientId, activeClient } = useWorkspace();

  const [activeTabId, setActiveTabId] = useState<string>('all');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const onApprovalsTab = activeTabId === APPROVALS_TAB_ID;

  const allTickets = useMemo(() => tickets ?? [], [tickets]);

  // Hero scope = workspace mode. Agency mode shows every accessible client's
  // tickets; sub-account mode narrows to the active client. Distinct from the
  // page-level `selectedClients` chip-filter (which composes on top — the
  // hero reflects the workspace context, not the operator's local drill).
  const heroScope = useMemo(
    () =>
      activeClientId
        ? allTickets.filter((t) => t.client.slug === activeClientId)
        : allTickets,
    [allTickets, activeClientId],
  );

  const heroStats = useMemo<AdminTicketHeroStat[]>(() => {
    const rush = heroScope.filter(
      (t) => t.urgency === 'rush' && t.status !== 'done',
    ).length;
    const open = heroScope.filter((t) => t.status === 'open').length;
    const inProgress = heroScope.filter(
      (t) => t.status === 'in_progress',
    ).length;
    const done = heroScope.filter((t) => t.status === 'done').length;
    return [
      { num: <em>{rush}</em>, label: '// RUSH', tone: 'warn' },
      { num: String(open), label: '// OPEN' },
      { num: String(inProgress), label: '// IN PROGRESS' },
      { num: <em>{done}</em>, label: '// DONE', tone: 'rust' },
    ];
  }, [heroScope]);

  const heroTag = useMemo(() => {
    const open = heroScope.filter((t) => t.status === 'open').length;
    if (activeClientId) {
      const name = activeClient?.name ?? 'this client';
      return open === 0
        ? `Quiet · no open tickets for ${name}`
        : `Live · ${open} open for ${name}`;
    }
    if (open === 0) return 'Quiet · no open tickets across your clients';
    const distinctClients = new Set(
      heroScope.filter((t) => t.status === 'open').map((t) => t.client.slug),
    ).size;
    return `Live · ${open} open across ${distinctClients} client${distinctClients === 1 ? '' : 's'}`;
  }, [heroScope, activeClientId, activeClient]);

  // Per-client ticket counts, keyed on client slug — shown in the dropdown.
  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of allTickets) {
      counts[t.client.slug] = (counts[t.client.slug] ?? 0) + 1;
    }
    return counts;
  }, [allTickets]);

  // The client filter narrows the pool; tab counts + the visible list are
  // computed against it so the filters compose.
  const clientPool = useMemo(
    () =>
      selectedClients.length === 0
        ? allTickets
        : allTickets.filter((t) => selectedClients.includes(t.client.slug)),
    [allTickets, selectedClients],
  );

  const tabs = useMemo<TicketTab[]>(() => {
    const withCounts = adminTicketTabs.map((tab) => ({
      ...tab,
      count: clientPool.filter((t) => matchesTab(t, tab.id)).length,
    }));
    const approvalsTab: TicketTab = {
      id: APPROVALS_TAB_ID,
      label: 'Approvals',
      count: pendingApprovals.length + pendingFunnelApprovals.length,
    };
    return [withCounts[0], approvalsTab, ...withCounts.slice(1)];
  }, [clientPool, pendingApprovals.length, pendingFunnelApprovals.length]);

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
        hideSearch
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Tickets" />
        }
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        <TicketsHero
          tag={heroTag}
          title={adminTicketsHero.title}
          subtitle={adminTicketsHero.subtitle}
          right={
            <>
              {heroStats.map((stat) => (
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
          <ClientMultiSelect
            label="// CLIENT"
            value={selectedClients}
            onChange={setSelectedClients}
            counts={clientCounts}
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
          <ApprovalsList
            website={pendingApprovals}
            funnel={pendingFunnelApprovals}
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
  tickets: AdminTicketRow[];
  isLoading: boolean;
  error: unknown;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
      <div className="hidden items-center gap-3 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet md:grid md:grid-cols-[20px_180px_1fr_110px_120px_110px_80px]">
        <div />
        <div>{'// Client'}</div>
        <div>{'// Subject'}</div>
        <div>{'// Category'}</div>
        <div>{'// Status'}</div>
        <div>{'// Urgency'}</div>
        <div className="text-right">{'// Age'}</div>
      </div>
      {isLoading ? (
        <ListNotice>{'// Loading tickets…'}</ListNotice>
      ) : error ? (
        <ListNotice>{`// ${normalizeError(error).message}`}</ListNotice>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-[18px] py-14 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Nothing in this tab'}
          </p>
          <h3 className="text-lg font-semibold text-ink">
            No tickets to triage.
          </h3>
          <p className="max-w-md text-sm text-ink-quiet">
            Tickets are how clients raise change requests — page edits,
            integration issues, billing questions. They show up here from
            every client you manage.
          </p>
        </div>
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
          No website or funnel changes awaiting approval. Submissions land
          here when an editor without publish capability hits{' '}
          <strong className="text-ink">Submit for review →</strong> on the
          review surface.
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
      {website.map((sub) => (
        <WebsiteApprovalRow key={sub.id} submission={sub} />
      ))}
      {funnel.map((sub) => (
        <FunnelApprovalRow key={sub.id} submission={sub} />
      ))}
    </div>
  );
}

export { AdminTicketsContent };
