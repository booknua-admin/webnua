import Link from 'next/link';

import { ConversationComposer } from '@/components/shared/leads/ConversationComposer';
import { ConversationHeader } from '@/components/shared/leads/ConversationHeader';
import { ConversationThread } from '@/components/shared/leads/ConversationThread';
import { PageHeader } from '@/components/shared/PageHeader';
import { RailCard } from '@/components/shared/RailCard';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { voltlineConversation } from '@/lib/leads/client-leads';

function ClientLeadConversationContent() {
  const conv = voltlineConversation;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Home', 'Leads', conv.name]}
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
                actions={conv.headerActions}
              />
              <ConversationThread days={conv.days} />
              <ConversationComposer
                channels={conv.composer.channels}
                channelToggle={conv.composer.channelToggle}
                placeholder={conv.composer.placeholder}
                defaultValue={conv.composer.defaultValue}
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
      </div>
    </>
  );
}

export { ClientLeadConversationContent };
