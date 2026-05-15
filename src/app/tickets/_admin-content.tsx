'use client';

import { useMemo, useState } from 'react';

import { AdminTicketsFilterBar } from '@/components/admin/tickets/AdminTicketsFilterBar';
import { WebsiteApprovalRow } from '@/components/admin/tickets/WebsiteApprovalRow';
import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import {
  TicketsHero,
  TicketsHeroStat,
} from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  adminTicketFilters,
  adminTickets,
  adminTicketsHero,
  adminTicketTabs,
} from '@/lib/tickets/admin-tickets';
import type { TicketTab } from '@/lib/tickets/types';
import { useAllPendingApprovals } from '@/lib/website/use-publish-state';

const APPROVALS_TAB_ID = 'website-approvals';

function AdminTicketsContent() {
  const pendingApprovals = useAllPendingApprovals();

  // Augment the static tab list with a live website-approvals tab whose
  // count tracks the overlay store. Inserted as the second tab so it sits
  // next to "All" — the queue you most want when you log in.
  const tabs = useMemo<TicketTab[]>(() => {
    const approvalsTab: TicketTab = {
      id: APPROVALS_TAB_ID,
      label: 'Website approvals',
      count: pendingApprovals.length,
    };
    return [adminTicketTabs[0], approvalsTab, ...adminTicketTabs.slice(1)];
  }, [pendingApprovals.length]);

  const [activeTabId, setActiveTabId] = useState<string>('all');
  const onApprovalsTab = activeTabId === APPROVALS_TAB_ID;

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

        <div className="flex items-center justify-between gap-4">
          <TicketTabsBar
            tabs={tabs}
            value={activeTabId}
            onChange={setActiveTabId}
          />
          {onApprovalsTab ? null : (
            <AdminTicketsFilterBar
              active={adminTicketFilters.active}
              available={adminTicketFilters.available}
            />
          )}
        </div>

        {onApprovalsTab ? (
          <ApprovalsList submissions={pendingApprovals} />
        ) : (
          <RegularTicketsList />
        )}
      </div>
    </>
  );
}

function RegularTicketsList() {
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
      {adminTickets.map((ticket) => (
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
      ))}
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
