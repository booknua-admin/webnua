'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ConversationHeader } from '@/components/shared/leads/ConversationHeader';
import { ConversationThread } from '@/components/shared/leads/ConversationThread';
import { LeadConversationComposer } from '@/components/shared/leads/LeadConversationComposer';
import { PageHeader } from '@/components/shared/PageHeader';
import { RailCard } from '@/components/shared/RailCard';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useLeadConversation } from '@/lib/leads/queries';

function ClientLeadConversationContent() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const { data: conv, isLoading, error } = useLeadConversation(id);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Home', 'Leads', conv?.name ?? 'Lead']}
            current="Conversation"
          />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <Link
          href={`/leads/${id}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-quiet transition-colors hover:text-rust"
        >
          <span aria-hidden>←</span>
          Back to lead
        </Link>

        {isLoading ? (
          <ConversationNotice>{'// Loading conversation…'}</ConversationNotice>
        ) : error || !conv ? (
          <ConversationNotice>
            {`// ${error ? normalizeError(error).message : 'Lead not found'}`}
          </ConversationNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={conv.tag}
              title={conv.title}
              subtitle={conv.subtitle}
            />

            <TicketDetailLayout
              main={
                <>
                  <ConversationHeader
                    avatar={conv.avatar}
                    name={conv.name}
                    meta={conv.headerMeta}
                    channelTabs={conv.channelTabs}
                    actions={conv.headerActions}
                  />
                  <ConversationThread days={conv.days} />
                  <LeadConversationComposer
                    leadId={conv.id}
                    firstName={conv.firstName}
                    hasEmail={conv.hasEmail}
                    helpers={conv.composer.helpers}
                  />
                </>
              }
              side={
                <>
                  {conv.rail.map((card) => (
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

function ConversationNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[14px] border border-ink/8 bg-card px-[18px] py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { ClientLeadConversationContent };
