import { LeadFilterChips } from '@/components/shared/leads/LeadFilterChips';
import { LeadRow } from '@/components/shared/leads/LeadRow';
import { LeadTabsBar } from '@/components/shared/leads/LeadTabsBar';
import { LeadsHero } from '@/components/shared/leads/LeadsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  adminLeads,
  adminLeadsClientFilters,
  adminLeadsHero,
  adminLeadsTabs,
} from '@/lib/leads/admin-leads';

function AdminLeadsContent() {
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Leads" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <LeadsHero
          tag={adminLeadsHero.eyebrow}
          title={adminLeadsHero.title}
          subtitle={adminLeadsHero.subtitle}
        />

        <LeadFilterChips
          label="// CLIENT"
          chips={adminLeadsClientFilters}
          defaultActiveId="all"
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

        <LeadTabsBar tabs={adminLeadsTabs} defaultActiveId="new" />

        <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
          <div className="grid grid-cols-[36px_180px_1fr_110px_90px_100px] items-center gap-3 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
            <div />
            <div>{'// Lead'}</div>
            <div>{'// Preview'}</div>
            <div>{'// Status'}</div>
            <div>{'// Age'}</div>
            <div className="text-right">{'// Activity'}</div>
          </div>
          {adminLeads.map((lead) => (
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
          ))}
        </div>
      </div>
    </>
  );
}

export { AdminLeadsContent };
