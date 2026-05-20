'use client';

import { useMemo, useState } from 'react';

import { LeadRow } from '@/components/shared/leads/LeadRow';
import { LeadTabsBar } from '@/components/shared/leads/LeadTabsBar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { normalizeError } from '@/lib/errors';
import { clientLeadsHero, clientLeadsTabs } from '@/lib/leads/client-leads';
import { useClientLeadsInbox } from '@/lib/leads/queries';

function ClientLeadsContent() {
  const [activeTab, setActiveTab] = useState('new');
  const { data: leads, isLoading, error } = useClientLeadsInbox();

  // Tab ids map 1:1 to LeadStatus (plus `all`). Counts are recomputed from
  // the live rows so the badge and the filtered list always agree.
  const tabs = useMemo(() => {
    const rows = leads ?? [];
    return clientLeadsTabs.map((tab) => ({
      ...tab,
      count:
        tab.id === 'all'
          ? rows.length
          : rows.filter((lead) => lead.status === tab.id).length,
    }));
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const rows = leads ?? [];
    return activeTab === 'all'
      ? rows
      : rows.filter((lead) => lead.status === activeTab);
  }, [leads, activeTab]);

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Leads" />}
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <PageHeader
          eyebrow={clientLeadsHero.eyebrow}
          title={clientLeadsHero.title}
          subtitle={clientLeadsHero.subtitle}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <LeadTabsBar tabs={tabs} value={activeTab} onChange={setActiveTab} />
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name, suburb, job…"
              className="h-9 w-[260px]"
            />
            <Button variant="secondary" className="h-9">
              Filters
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[14px] border border-ink/8 bg-card">
          {isLoading ? (
            <InboxNotice>{'// Loading leads…'}</InboxNotice>
          ) : error ? (
            <InboxNotice>
              {`// ${normalizeError(error).message}`}
            </InboxNotice>
          ) : visibleLeads.length === 0 ? (
            <InboxNotice>{'// No leads in this view'}</InboxNotice>
          ) : (
            visibleLeads.map((lead) => (
              <LeadRow
                key={lead.id}
                variant="client"
                initial={lead.initial}
                name={lead.name}
                suburb={lead.suburb}
                preview={lead.preview}
                status={lead.status}
                statusLabel={lead.statusLabel}
                urgency={lead.urgency}
                age={lead.age}
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

export { ClientLeadsContent };
