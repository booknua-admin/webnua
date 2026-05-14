import {
  CategoryPill,
  StatusPill,
  UrgencyPill,
} from '@/components/shared/tickets/pills';
import { TicketActionRow } from '@/components/shared/tickets/TicketActionRow';
import { TicketDetailHeader, TicketIdLabel } from '@/components/shared/tickets/TicketDetailHeader';
import { TicketDetailLayout } from '@/components/shared/tickets/TicketDetailLayout';
import { TicketPropertyRow } from '@/components/shared/tickets/TicketPropertyRow';
import { TicketReply } from '@/components/shared/tickets/TicketReply';
import { TicketSideCard } from '@/components/shared/tickets/TicketSideCard';
import { TicketStatusCard } from '@/components/shared/tickets/TicketStatusCard';
import { TicketThreadMessage } from '@/components/shared/tickets/TicketThreadMessage';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { clientTicketDetail } from '@/lib/tickets/client-detail';

const REPLY_TOOLS = [
  { icon: '⤴', title: 'Attach file' },
  { icon: '▣', title: 'Add image' },
  { icon: '◉', title: 'Voice note' },
];

function ClientTicketDetailContent() {
  const t = clientTicketDetail;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Home', 'Tickets']} current={t.id} />
        }
      />
      <div className="px-10 py-10">
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
                    <StatusPill
                      status={t.status}
                      label={t.statusLabel}
                    />
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
              <TicketSideCard heading="// Properties">
                {t.properties.map((p) => (
                  <TicketPropertyRow
                    key={p.label}
                    label={p.label}
                    value={p.value}
                  />
                ))}
              </TicketSideCard>
              <TicketSideCard heading="// Actions">
                {t.actions.map((a) => (
                  <TicketActionRow
                    key={a.label}
                    icon={a.icon}
                    label={a.label}
                  />
                ))}
              </TicketSideCard>
            </>
          }
        />
      </div>
    </>
  );
}

export { ClientTicketDetailContent };
