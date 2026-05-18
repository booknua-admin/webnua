'use client';

import { useMemo, useState } from 'react';

import { LeadRow } from '@/components/shared/leads/LeadRow';
import { LeadTabsBar } from '@/components/shared/leads/LeadTabsBar';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  clientLeads,
  clientLeadsHero,
  clientLeadsTabs,
} from '@/lib/leads/client-leads';

function ClientLeadsContent() {
  const [activeTab, setActiveTab] = useState('new');

  // Tab ids map 1:1 to LeadStatus (plus `all`). Counts are recomputed from
  // the data so the badge and the filtered list always agree.
  const tabs = useMemo(
    () =>
      clientLeadsTabs.map((tab) => ({
        ...tab,
        count:
          tab.id === 'all'
            ? clientLeads.length
            : clientLeads.filter((lead) => lead.status === tab.id).length,
      })),
    [],
  );

  const visibleLeads = useMemo(
    () =>
      activeTab === 'all'
        ? clientLeads
        : clientLeads.filter((lead) => lead.status === activeTab),
    [activeTab],
  );

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
          {visibleLeads.length === 0 ? (
            <p className="px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {'// No leads in this view'}
            </p>
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

export { ClientLeadsContent };
