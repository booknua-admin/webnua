import Link from 'next/link';

import { LeadDetailHeader } from '@/components/shared/leads/LeadDetailHeader';
import { LeadQuickActions } from '@/components/shared/leads/LeadQuickActions';
import { LeadStatusSwitcher } from '@/components/shared/leads/LeadStatusSwitcher';
import { LeadTimeline } from '@/components/shared/leads/LeadTimeline';
import { PageHeader } from '@/components/shared/PageHeader';
import { RailCard } from '@/components/shared/RailCard';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { freshhomeLeadDetail } from '@/lib/leads/admin-leads';

function AdminLeadDetailContent() {
  const lead = freshhomeLeadDetail;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Workspace', 'Leads']}
            current={lead.name}
          />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <Link
          href={lead.backHref}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-quiet transition-colors hover:text-rust"
        >
          <span aria-hidden>←</span>
          {lead.backLabel}
        </Link>

        <PageHeader
          eyebrow={lead.tag}
          title={lead.title}
          subtitle={lead.subtitle}
        />

        <TicketDetailLayout
          main={
            <>
              <LeadDetailHeader
                avatar={lead.avatar}
                name={lead.name}
                metaParts={lead.metaParts}
                clientPillLabel={lead.clientPillLabel}
              />
              <LeadStatusSwitcher defaultStatus={lead.status} />
              <LeadTimeline
                count={lead.timeline.eventCount}
                events={lead.timeline.events}
              />
            </>
          }
          side={
            <>
              <RailCard heading="// QUICK ACTIONS">
                <LeadQuickActions actions={lead.quickActions} />
              </RailCard>
              {lead.rail.map((card) => (
                <RailCard
                  key={card.heading}
                  heading={card.heading}
                  rows={card.rows}
                />
              ))}
            </>
          }
        />
      </div>
    </>
  );
}

export { AdminLeadDetailContent };
