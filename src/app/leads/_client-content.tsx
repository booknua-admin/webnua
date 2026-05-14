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
          <LeadTabsBar tabs={clientLeadsTabs} defaultActiveId="new" />
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
          {clientLeads.map((lead) => (
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
          ))}
        </div>
      </div>
    </>
  );
}

export { ClientLeadsContent };
