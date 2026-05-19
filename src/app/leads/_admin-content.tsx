'use client';

import { useMemo, useState } from 'react';

import { ClientMultiSelect } from '@/components/shared/ClientMultiSelect';
import { LeadRow } from '@/components/shared/leads/LeadRow';
import { LeadTabsBar } from '@/components/shared/leads/LeadTabsBar';
import { LeadsHero } from '@/components/shared/leads/LeadsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeError } from '@/lib/errors';
import { adminLeadsHero, adminLeadsTabs } from '@/lib/leads/admin-leads';
import { useAdminLeadsInbox } from '@/lib/leads/queries';

function AdminLeadsContent() {
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('new');
  const { data: leads, isLoading, error } = useAdminLeadsInbox();

  // The client filter narrows the pool first; tab counts + the visible
  // list are both computed against that already-narrowed pool so the two
  // filters compose correctly.
  const allLeads = useMemo(() => leads ?? [], [leads]);

  const clientPool = useMemo(
    () =>
      selectedClients.length === 0
        ? allLeads
        : allLeads.filter((lead) => selectedClients.includes(lead.clientSlug)),
    [allLeads, selectedClients],
  );

  // Per-client lead counts, keyed on client slug — shown in the dropdown.
  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of allLeads) {
      counts[lead.clientSlug] = (counts[lead.clientSlug] ?? 0) + 1;
    }
    return counts;
  }, [allLeads]);

  // Tab ids map 1:1 to LeadStatus. Counts recomputed from the client pool.
  const tabs = useMemo(
    () =>
      adminLeadsTabs.map((tab) => ({
        ...tab,
        count: clientPool.filter((lead) => lead.status === tab.id).length,
      })),
    [clientPool],
  );

  const visibleLeads = useMemo(
    () => clientPool.filter((lead) => lead.status === activeTab),
    [clientPool, activeTab],
  );

  return (
    <>
      <Topbar
        hideSearch
        breadcrumb={<TopbarBreadcrumb trail={['Workspace']} current="Leads" />}
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <LeadsHero
          tag={adminLeadsHero.eyebrow}
          title={adminLeadsHero.title}
          subtitle={adminLeadsHero.subtitle}
        />

        <ClientMultiSelect
          label="// CLIENT"
          value={selectedClients}
          onChange={setSelectedClients}
          counts={clientCounts}
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
          <div className="grid grid-cols-[36px_180px_1fr_110px_90px_100px] items-center gap-3 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
            <div />
            <div>{'// Lead'}</div>
            <div>{'// Preview'}</div>
            <div>{'// Status'}</div>
            <div>{'// Age'}</div>
            <div className="text-right">{'// Activity'}</div>
          </div>
          {isLoading ? (
            <InboxNotice>{'// Loading leads…'}</InboxNotice>
          ) : error ? (
            <InboxNotice>{`// ${normalizeError(error).message}`}</InboxNotice>
          ) : visibleLeads.length === 0 ? (
            <InboxNotice>{'// No leads in this view'}</InboxNotice>
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

export { AdminLeadsContent };
