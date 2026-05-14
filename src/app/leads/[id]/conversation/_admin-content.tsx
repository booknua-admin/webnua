import Link from 'next/link';

import { ConversationComposer } from '@/components/shared/leads/ConversationComposer';
import { ConversationHeader } from '@/components/shared/leads/ConversationHeader';
import { ConversationThread } from '@/components/shared/leads/ConversationThread';
import { LeadRailCard } from '@/components/shared/leads/LeadRailCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { freshhomeConversation } from '@/lib/leads/admin-leads';

function AdminLeadConversationContent() {
  const conv = freshhomeConversation;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Workspace', 'Leads', conv.name]}
            current="Conversation"
          />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <Link
          href={conv.backHref}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-quiet transition-colors hover:text-rust"
        >
          <span aria-hidden>←</span>
          {conv.backLabel}
        </Link>

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
                defaultChannelId="all"
              />
              <ConversationThread days={conv.days} />
              <ConversationComposer
                channelToggle={conv.composer.channelToggle}
                placeholder={conv.composer.placeholder}
                defaultValue={conv.composer.defaultValue}
              />
            </>
          }
          side={
            <>
              {conv.rail
                .slice(0, 1)
                .map((card) => (
                  <LeadRailCard
                    key={card.heading}
                    heading={card.heading}
                    rows={card.rows}
                  />
                ))}
              {conv.quickReplies && conv.quickReplies.length > 0 ? (
                <LeadRailCard heading="// QUICK REPLIES">
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
                </LeadRailCard>
              ) : null}
              {conv.rail.slice(1).map((card) => (
                <LeadRailCard
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

export { AdminLeadConversationContent };
