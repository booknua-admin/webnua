'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { GbpSendRequestButton } from '@/components/shared/gbp/GbpSendRequestButton';
import { LeadAutomationPanel } from '@/components/shared/leads/LeadAutomationPanel';
import { LeadDetailHeader } from '@/components/shared/leads/LeadDetailHeader';
import { LeadQuickActions } from '@/components/shared/leads/LeadQuickActions';
import { LeadStatusSwitcher } from '@/components/shared/leads/LeadStatusSwitcher';
import { LeadTimeline } from '@/components/shared/leads/LeadTimeline';
import { PageHeader } from '@/components/shared/PageHeader';
import { RailCard } from '@/components/shared/RailCard';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useLeadDetail, useMarkLeadRead } from '@/lib/leads/queries';

function AdminLeadDetailContent() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const { data: lead, isLoading, error } = useLeadDetail(id);

  // Opening the lead marks it read for the current operator (upserts
  // lead_reads.read_at = now()). Fire-and-forget — a failed mark-read
  // doesn't fail the page. Re-runs only when the id changes.
  const markRead = useMarkLeadRead();
  useEffect(() => {
    if (id) markRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Workspace', 'Leads']}
            current={lead?.name ?? 'Lead'}
          />
        }
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-quiet transition-colors hover:text-rust"
        >
          <span aria-hidden>←</span>
          Back to lead inbox
        </Link>

        {isLoading ? (
          <DetailNotice>{'// Loading lead…'}</DetailNotice>
        ) : error || !lead ? (
          <DetailNotice>
            {`// ${error ? normalizeError(error).message : 'Lead not found'}`}
          </DetailNotice>
        ) : (
          <>
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
                  <LeadStatusSwitcher leadId={id} defaultStatus={lead.status} />
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
                    <div className="mt-2">
                      <GbpSendRequestButton
                        context={{
                          clientId: lead.gbpContext.clientId,
                          recipientName: lead.gbpContext.recipientName,
                          recipientPhone: lead.gbpContext.recipientPhone,
                          recipientEmail: lead.gbpContext.recipientEmail,
                          leadId: lead.id,
                        }}
                        variant="action-row"
                      />
                    </div>
                  </RailCard>
                  <LeadAutomationPanel leadId={id} />
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
          </>
        )}
      </div>
    </>
  );
}

function DetailNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[14px] border border-ink/8 bg-card px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { AdminLeadDetailContent };
