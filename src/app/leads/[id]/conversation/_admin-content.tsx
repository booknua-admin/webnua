'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ConversationHeader } from '@/components/shared/leads/ConversationHeader';
import { ConversationThread } from '@/components/shared/leads/ConversationThread';
import { LeadConversationComposer } from '@/components/shared/leads/LeadConversationComposer';
import { PageHeader } from '@/components/shared/PageHeader';
import { RailCard } from '@/components/shared/RailCard';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useLeadConversation } from '@/lib/leads/queries';

function AdminLeadConversationContent() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const { data: conv, isLoading, error } = useLeadConversation(id);

  // Lift channel selection so the conversation header tabs and the
  // composer's channel pills can't get out of sync. Both are bound to
  // this single value — picking one updates the other.
  const [activeChannel, setActiveChannel] = useState<string>(
    conv?.hasEmail ? 'Email' : 'SMS',
  );

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Workspace', 'Leads', conv?.name ?? 'Lead']}
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
                    activeChannelId={activeChannel}
                    onChannelChange={setActiveChannel}
                  />
                  <ConversationThread days={conv.days} />
                  <LeadConversationComposer
                    leadId={conv.id}
                    firstName={conv.firstName}
                    hasEmail={conv.hasEmail}
                    activeChannelId={activeChannel}
                    onChannelChange={setActiveChannel}
                  />
                </>
              }
              side={
                <>
                  {conv.rail.slice(0, 1).map((card) => (
                    <RailCard
                      key={card.heading}
                      heading={card.heading}
                      rows={card.rows}
                    />
                  ))}
                  {conv.quickReplies && conv.quickReplies.length > 0 ? (
                    <RailCard heading="// QUICK REPLIES">
                      <div className="flex flex-col gap-1.5">
                        {conv.quickReplies.map((reply) => (
                          <button
                            key={reply.label}
                            type="button"
                            className="flex items-center gap-2 rounded-[8px] border border-rule bg-paper px-3 py-2 text-left text-[12.5px] text-ink transition-colors hover:border-rust hover:bg-rust/[0.06]"
                          >
                            <span aria-hidden>{reply.icon}</span>
                            {reply.label}
                          </button>
                        ))}
                      </div>
                    </RailCard>
                  ) : null}
                  {conv.rail.slice(1).map((card) => (
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

export { AdminLeadConversationContent };
