'use client';

import { useMemo, useState } from 'react';

import {
  LeadCompletionFilter,
  type LeadCompletionFilterValue,
} from '@/components/shared/leads/LeadCompletionFilter';
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
  // Funnel-run completion filter — opt-in narrowing, default 'all'. See
  // `LeadCompletionFilter` for the action-not-grade framing.
  const [completionFilter, setCompletionFilter] =
    useState<LeadCompletionFilterValue>('all');
  const { data: leads, isLoading, error } = useClientLeadsInbox();

  // Completion narrows the pool first; tabs + the visible list compose
  // against the narrowed pool so the two filters interact correctly.
  const completionPool = useMemo(() => {
    const rows = leads ?? [];
    return completionFilter === 'all'
      ? rows
      : rows.filter((lead) => lead.completion === completionFilter);
  }, [leads, completionFilter]);

  // Tab ids map 1:1 to LeadStatus (plus `all`). Counts are recomputed from
  // the live rows so the badge and the filtered list always agree.
  const tabs = useMemo(() => {
    return clientLeadsTabs.map((tab) => ({
      ...tab,
      count:
        tab.id === 'all'
          ? completionPool.length
          : completionPool.filter((lead) => lead.status === tab.id).length,
    }));
  }, [completionPool]);

  const visibleLeads = useMemo(() => {
    return activeTab === 'all'
      ? completionPool
      : completionPool.filter((lead) => lead.status === activeTab);
  }, [completionPool, activeTab]);

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

        <LeadCompletionFilter
          value={completionFilter}
          onChange={setCompletionFilter}
        />

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
