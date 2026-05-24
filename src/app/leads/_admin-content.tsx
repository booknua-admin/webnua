'use client';

import { useMemo, useState } from 'react';

import { ColdLeadRow } from '@/components/shared/leads/ColdLeadRow';
import { LeadRow } from '@/components/shared/leads/LeadRow';
import { LeadTabsBar } from '@/components/shared/leads/LeadTabsBar';
import { LeadsHero } from '@/components/shared/leads/LeadsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeError } from '@/lib/errors';
import { adminLeadsHero, adminLeadsTabs } from '@/lib/leads/admin-leads';
import { isColdLeadRow, useAdminLeadsInbox } from '@/lib/leads/queries';

/**
 * Operator agency-mode leads inbox — cross-client roster.
 *
 * The sidebar `AdminClientPicker` is canonical for narrowing scope; the
 * in-page client multi-select was dropped (Phase 9b · Session 1). When an
 * operator drills into a client, the `/leads` dispatcher hands off to
 * `_sub-account-content.tsx` instead.
 */
function AdminLeadsContent() {
  const [activeTab, setActiveTab] = useState('new');
  const { data: leads, isLoading, error } = useAdminLeadsInbox();

  const clientPool = useMemo(() => leads ?? [], [leads]);

  // Tab ids map 1:1 to LeadStatus (with the orthogonal `needs_followup`
  // surface added in Phase 8 Session 2). The badge represents:
  //   • `needs_followup` → the count of cold leads still awaiting a nudge
  //     (the whole count matters, not just unread — cold leads need a
  //     personal reply regardless of read state).
  //   • status tabs → the count of UNREAD leads in that tab (email-inbox
  //     model: count = things that need looking at, not total volume).
  const tabs = useMemo(
    () =>
      adminLeadsTabs.map((tab) => {
        if (tab.id === 'needs_followup') {
          return { ...tab, count: clientPool.filter(isColdLeadRow).length };
        }
        const tabRows = clientPool.filter((lead) => lead.status === tab.id);
        return {
          ...tab,
          count: tabRows.filter((lead) => lead.unread).length,
        };
      }),
    [clientPool],
  );

  const visibleLeads = useMemo(
    () =>
      activeTab === 'needs_followup'
        ? clientPool
            .filter(isColdLeadRow)
            .sort((a, b) =>
              (b.needsFollowupAt ?? '').localeCompare(a.needsFollowupAt ?? ''),
            )
        : clientPool.filter((lead) => lead.status === activeTab),
    [clientPool, activeTab],
  );

  const showingColdTab = activeTab === 'needs_followup';

  return (
    <>
      <Topbar
        hideSearch
        breadcrumb={<TopbarBreadcrumb trail={['Workspace']} current="Leads" />}
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        <LeadsHero
          tag={adminLeadsHero.eyebrow}
          title={adminLeadsHero.title}
          subtitle={adminLeadsHero.subtitle}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name, phone, or message…"
              className="h-9 w-[320px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-9">
              Export CSV
            </Button>
            <Button className="h-9 bg-rust text-paper hover:bg-rust-light">
              + Add lead manually
            </Button>
          </div>
        </div>

        <LeadTabsBar tabs={tabs} value={activeTab} onChange={setActiveTab} />

        <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
          <div className="overflow-x-auto">
          <div className="min-w-[620px]">
          {showingColdTab ? (
            <ColdHeaderRow />
          ) : (
            <div className="grid grid-cols-[36px_180px_1fr_110px_80px_80px_100px] items-center gap-3 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
              <div />
              <div>{'// Lead'}</div>
              <div>{'// Preview'}</div>
              <div>{'// Status'}</div>
              <div>{'// Source'}</div>
              <div>{'// Age'}</div>
              <div className="text-right">{'// Activity'}</div>
            </div>
          )}
          {isLoading ? (
            <InboxNotice>{'// Loading leads…'}</InboxNotice>
          ) : error ? (
            <InboxNotice>{`// ${normalizeError(error).message}`}</InboxNotice>
          ) : visibleLeads.length === 0 ? (
            <InboxNotice>
              {showingColdTab
                ? '// Nothing to nudge. Every lead is fresh or already handled.'
                : '// No leads in this view'}
            </InboxNotice>
          ) : showingColdTab ? (
            visibleLeads.map((lead) => (
              <ColdLeadRow key={lead.id} variant="admin" row={lead} />
            ))
          ) : (
            visibleLeads.map((lead) => (
              <LeadRow
                key={lead.id}
                variant="admin"
                initial={lead.initial}
                name={lead.name}
                clientName={lead.clientName}
                clientService={lead.clientService}
                clientTone={lead.clientTone}
                preview={lead.preview}
                status={lead.status}
                statusLabel={lead.statusLabel}
                age={lead.age}
                meta={lead.meta}
                metaTone={lead.metaTone}
                unread={lead.unread}
                href={lead.href}
                sourceKind={lead.sourceKind}
              />
            ))
          )}
          </div>
          </div>
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

/** The header row above the cold-lead list — different shape than the
 *  status-tab rows since the cold rows carry a "Dismiss" affordance and
 *  the dominant signal is "needs nudging now". */
function ColdHeaderRow() {
  return (
    <div className="grid grid-cols-[4px_36px_1fr_140px_120px_auto] items-center gap-3 border-b border-ink/8 bg-warn-soft/30 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
      <div />
      <div />
      <div>{'// Lead'}</div>
      <div>{'// Nudge'}</div>
      <div>{'// Last outbound'}</div>
      <div className="text-right">{'// Dismiss'}</div>
    </div>
  );
}

export { AdminLeadsContent };
