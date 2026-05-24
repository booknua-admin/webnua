'use client';

import { useParams } from 'next/navigation';

import { RailCard } from '@/components/shared/RailCard';
import { RailPropertyRow } from '@/components/shared/RailPropertyRow';
import {
  CategoryPill,
  StatusPill,
  UrgencyPill,
} from '@/components/shared/tickets/pills';
import { TicketActionList } from '@/components/shared/tickets/TicketActionList';
import { TicketDetailHeader, TicketIdLabel } from '@/components/shared/tickets/TicketDetailHeader';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { TicketReply } from '@/components/shared/tickets/TicketReply';
import { TicketStatusCard } from '@/components/shared/tickets/TicketStatusCard';
import { TicketThreadMessage } from '@/components/shared/tickets/TicketThreadMessage';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useClientTicketDetail } from '@/lib/tickets/queries';

const REPLY_TOOLS = [
  { icon: '⤴', title: 'Attach file' },
  { icon: '▣', title: 'Add image' },
  { icon: '◉', title: 'Voice note' },
];

function ClientTicketDetailContent() {
  const params = useParams<{ id: string }>();
  const reference = params.id ?? '';
  const { data: t, isLoading, error } = useClientTicketDetail(reference);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Home', 'Tickets']}
            current={t?.id ?? reference}
          />
        }
      />
      <div className="px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <DetailNotice>{'// Loading ticket…'}</DetailNotice>
        ) : error || !t ? (
          <DetailNotice>
            {`// ${error ? normalizeError(error).message : 'Ticket not found'}`}
          </DetailNotice>
        ) : (
          <TicketDetailLayout
            main={
              <>
                <TicketDetailHeader
                  backHref="/tickets"
                  backLabel="back to tickets"
                  pills={
                    <>
                      <TicketIdLabel id={t.id} />
                      <CategoryPill category={t.category} />
                      <StatusPill status={t.status} label={t.statusLabel} />
                      <UrgencyPill urgency={t.urgency} />
                    </>
                  }
                  title={t.title}
                  meta={t.metaLine}
                />
                <div className="flex flex-col gap-[18px] px-7 py-6">
                  {t.thread.map((msg) => (
                    <TicketThreadMessage
                      key={msg.id}
                      author={msg.author}
                      avatar={msg.avatar}
                      name={msg.name}
                      role={msg.role}
                      time={msg.time}
                    >
                      {msg.body}
                    </TicketThreadMessage>
                  ))}
                </div>
                <TicketReply
                  ticketReference={t.id}
                  label={t.reply.label}
                  placeholder={t.reply.placeholder}
                  chips={t.reply.chips}
                  tools={REPLY_TOOLS}
                  sendLabel={t.reply.sendLabel}
                />
              </>
            }
            side={
              <>
                <TicketStatusCard
                  mode="display"
                  status={t.status}
                  statusLabel={t.statusHeadline}
                  description={t.statusDescription}
                />
                <RailCard heading="// Properties">
                  {t.properties.map((p) => (
                    <RailPropertyRow
                      key={p.label}
                      label={p.label}
                      value={p.value}
                    />
                  ))}
                </RailCard>
                <RailCard heading="// Actions">
                  <TicketActionList actions={t.actions} />
                </RailCard>
              </>
            }
          />
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

export { ClientTicketDetailContent };
