'use client';

import { useMemo, useState } from 'react';

import { SkeletonRows } from '@/components/shared/PageSkeleton';
import { ColdLeadRow } from '@/components/shared/leads/ColdLeadRow';
import { LeadRow } from '@/components/shared/leads/LeadRow';
import { LeadTabsBar } from '@/components/shared/leads/LeadTabsBar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeError } from '@/lib/errors';
import { adminLeadsTabs } from '@/lib/leads/admin-leads';
import { isColdLeadRow, useAdminLeadsInbox } from '@/lib/leads/queries';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

/**
 * Operator-in-sub-account leads inbox — drilled into one client.
 *
 * Same single-business shape the client sees on `_client-content.tsx`,
 * fed by the operator's accessible-clients query and filtered to the
 * active client. No `ClientMultiSelect` (sidebar is canonical), no
 * `WorkspaceContextBanner` (the hero already says which client), no
 * per-row client pill / activity meta. Operator capabilities apply via
 * role, not row shape.
 */
function SubAccountLeadsContent() {
  const activeClient = useActiveClient();
  const { activeClientId } = useWorkspace();
  const [activeTab, setActiveTab] = useState('new');
  const { data: leads, isLoading, error } = useAdminLeadsInbox();

  const allLeads = useMemo(
    () => (leads ?? []).filter((lead) => lead.clientSlug === activeClientId),
    [leads, activeClientId],
  );

  const tabs = useMemo(
    () =>
      adminLeadsTabs.map((tab) => {
        if (tab.id === 'needs_followup') {
          return { ...tab, count: allLeads.filter(isColdLeadRow).length };
        }
        const tabRows = allLeads.filter((lead) => lead.status === tab.id);
        return {
          ...tab,
          count: tabRows.filter((lead) => lead.unread).length,
        };
      }),
    [allLeads],
  );

  const visibleLeads = useMemo(
    () =>
      activeTab === 'needs_followup'
        ? allLeads
            .filter(isColdLeadRow)
            .sort((a, b) =>
              (b.needsFollowupAt ?? '').localeCompare(a.needsFollowupAt ?? ''),
            )
        : allLeads.filter((lead) => lead.status === activeTab),
    [allLeads, activeTab],
  );

  const showingColdTab = activeTab === 'needs_followup';
  const clientName = activeClient?.name ?? 'this client';

  return (
    <>
      <Topbar
        hideSearch
        breadcrumb={<TopbarBreadcrumb trail={[clientName]} current="Leads" />}
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        <PageHeader
          eyebrow={`// ${clientName.toUpperCase()} · LEADS`}
          title={
            <>
              Lead <em>inbox</em>.
            </>
          }
          subtitle={
            <>
              Every lead from <strong>{clientName}</strong>. Click a row to
              open the full conversation thread.
            </>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <LeadTabsBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name, phone, or message…"
              className="h-9 w-[260px]"
            />
            <Button variant="secondary" className="h-9">
              Export CSV
            </Button>
            <Button className="h-9 bg-rust text-paper hover:bg-rust-light">
              + Add lead manually
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-ink/8 bg-card">
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
            <SkeletonRows />
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

export { SubAccountLeadsContent };
