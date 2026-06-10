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
import { clientLeadsHero, clientLeadsTabs } from '@/lib/leads/client-leads';
import { isColdLeadRow, useClientLeadsInbox } from '@/lib/leads/queries';

function ClientLeadsContent() {
  const [activeTab, setActiveTab] = useState('new');
  const { data: leads, isLoading, error } = useClientLeadsInbox();

  // Tab ids map to LeadStatus (plus `all`) — and the orthogonal
  // `needs_followup` cold-lead tab from Phase 8 Session 2.
  const tabs = useMemo(() => {
    const rows = leads ?? [];
    return clientLeadsTabs.map((tab) => {
      if (tab.id === 'needs_followup') {
        return { ...tab, count: rows.filter(isColdLeadRow).length };
      }
      const tabRows =
        tab.id === 'all' ? rows : rows.filter((lead) => lead.status === tab.id);
      return {
        ...tab,
        count: tabRows.filter((lead) => lead.unread).length,
      };
    });
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const rows = leads ?? [];
    if (activeTab === 'needs_followup') {
      return rows
        .filter(isColdLeadRow)
        .sort((a, b) =>
          (b.needsFollowupAt ?? '').localeCompare(a.needsFollowupAt ?? ''),
        );
    }
    return activeTab === 'all'
      ? rows
      : rows.filter((lead) => lead.status === activeTab);
  }, [leads, activeTab]);

  const showingColdTab = activeTab === 'needs_followup';

  // Live eyebrow — "// N leads in your inbox" (singular/plural, hide count
  // line when the inbox is empty). Replaces the previous hardcoded
  // "// Voltline · 23 leads total" which leaked another customer's name.
  const heroEyebrow = useMemo(() => {
    const total = (leads ?? []).length;
    if (total === 0) return '// Your lead inbox';
    return `// ${total} lead${total === 1 ? '' : 's'} in your inbox`;
  }, [leads]);

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Home']} current="Leads" />}
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        <PageHeader
          eyebrow={heroEyebrow}
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
            <SkeletonRows />
          ) : error ? (
            <InboxNotice>
              {`// ${normalizeError(error).message}`}
            </InboxNotice>
          ) : visibleLeads.length === 0 ? (
            showingColdTab ? (
              <InboxNotice>
                {'// Nothing to nudge. Every lead is fresh or already handled.'}
              </InboxNotice>
            ) : (
              <div className="flex flex-col items-center gap-3 px-[18px] py-14 text-center">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// No leads to show'}
                </p>
                <h3 className="text-lg font-semibold text-ink">
                  No leads yet.
                </h3>
                <p className="max-w-md text-sm text-ink-quiet">
                  Leads land here when someone fills out your funnel form or
                  a contact block on your site. Share your funnel link, or
                  check back after your next customer reaches out.
                </p>
              </div>
            )
          ) : showingColdTab ? (
            visibleLeads.map((lead) => (
              <ColdLeadRow key={lead.id} variant="client" row={lead} />
            ))
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
