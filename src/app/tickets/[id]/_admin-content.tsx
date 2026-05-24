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
import { useAdminTicketDetail } from '@/lib/tickets/queries';
import { cn } from '@/lib/utils';

const REPLY_TOOLS = [
  { icon: '⤴', title: 'Attach file' },
  { icon: '⌕', title: 'Insert link' },
  { icon: '▤', title: 'Template' },
];

const CLIENT_TONE_BG: Record<string, string> = {
  voltline: 'bg-rust',
  freshhome: 'bg-[#2d4a3a]',
  keyhero: 'bg-[#6a5230]',
  flowline: 'bg-[#2d4a6a]',
  generic: 'bg-ink',
};

function AdminTicketDetailContent() {
  const params = useParams<{ id: string }>();
  const reference = params.id ?? '';
  const { data: t, isLoading, error } = useAdminTicketDetail(reference);

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb
            trail={['Workspace', 'Tickets']}
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
                  backLabel="back to inbox"
                  pills={
                    <>
                      <TicketIdLabel id={t.id} />
                      <CategoryPill category={t.category} />
                      <StatusPill status={t.status} />
                      <UrgencyPill urgency={t.urgency} />
                    </>
                  }
                  title={t.title}
                  meta={
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={cn(
                          'flex size-6 items-center justify-center rounded-[6px] text-[11px] font-extrabold text-paper',
                          CLIENT_TONE_BG[t.client.tone ?? 'generic'],
                        )}
                      >
                        {t.client.initial}
                      </span>
                      <span>{t.metaLine}</span>
                    </div>
                  }
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
                  placeholder={t.reply.placeholder}
                  defaultValue={t.reply.defaultValue}
                  tools={REPLY_TOOLS}
                  sendLabel={t.reply.sendLabel}
                />
              </>
            }
            side={
              <>
                <TicketStatusCard
                  mode="pick"
                  options={t.statusOptions}
                  activeStatus={t.status}
                />
                <RailCard heading="// Properties">
                  {t.properties.map((p) => (
                    <RailPropertyRow
                      key={p.label}
                      label={p.label}
                      value={p.value}
                      editable={p.editable}
                    />
                  ))}
                </RailCard>
                <RailCard heading="// Quick actions">
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

export { AdminTicketDetailContent };
