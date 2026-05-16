import { RailCard } from '@/components/shared/RailCard';
import { RailPropertyRow } from '@/components/shared/RailPropertyRow';
import {
  CategoryPill,
  StatusPill,
  UrgencyPill,
} from '@/components/shared/tickets/pills';
import { TicketActionRow } from '@/components/shared/tickets/TicketActionRow';
import { TicketDetailHeader, TicketIdLabel } from '@/components/shared/tickets/TicketDetailHeader';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { TicketReply } from '@/components/shared/tickets/TicketReply';
import { TicketStatusCard } from '@/components/shared/tickets/TicketStatusCard';
import { TicketThreadMessage } from '@/components/shared/tickets/TicketThreadMessage';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { cn } from '@/lib/utils';
import { adminTicketDetail } from '@/lib/tickets/admin-detail';

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
  const t = adminTicketDetail;
  const toneBg = CLIENT_TONE_BG[t.client.tone ?? 'generic'];

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace', 'Tickets']} current={t.id} />
        }
      />
      <div className="px-10 py-10">
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
                        toneBg,
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
                {t.actions.map((a) => (
                  <TicketActionRow
                    key={a.label}
                    icon={a.icon}
                    label={a.label}
                  />
                ))}
              </RailCard>
            </>
          }
        />
      </div>
    </>
  );
}

export { AdminTicketDetailContent };
