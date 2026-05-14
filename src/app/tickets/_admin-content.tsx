import { AdminTicketsFilterBar } from '@/components/admin/tickets/AdminTicketsFilterBar';
import { TicketRow } from '@/components/shared/tickets/TicketRow';
import { TicketTabsBar } from '@/components/shared/tickets/TicketTabsBar';
import {
  TicketsHero,
  TicketsHeroStat,
} from '@/components/shared/tickets/TicketsHero';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  adminTicketFilters,
  adminTickets,
  adminTicketsHero,
  adminTicketTabs,
} from '@/lib/tickets/admin-tickets';

function AdminTicketsContent() {
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Tickets" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <TicketsHero
          tag={adminTicketsHero.tag}
          title={adminTicketsHero.title}
          subtitle={adminTicketsHero.subtitle}
          right={
            <>
              {adminTicketsHero.stats.map((stat) => (
                <TicketsHeroStat
                  key={stat.label}
                  num={stat.num}
                  label={stat.label}
                  tone={stat.tone}
                />
              ))}
            </>
          }
        />

        <div className="flex items-center justify-between gap-4">
          <TicketTabsBar tabs={adminTicketTabs} defaultActiveId="all" />
          <AdminTicketsFilterBar
            active={adminTicketFilters.active}
            available={adminTicketFilters.available}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink/8 bg-card">
          <div className="grid grid-cols-[20px_180px_1fr_110px_120px_110px_80px] items-center gap-3 border-b border-ink/8 bg-paper-2/40 px-[18px] py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
            <div />
            <div>{'// Client'}</div>
            <div>{'// Subject'}</div>
            <div>{'// Category'}</div>
            <div>{'// Status'}</div>
            <div>{'// Urgency'}</div>
            <div className="text-right">{'// Age'}</div>
          </div>
          {adminTickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              variant="admin"
              title={ticket.title}
              preview={ticket.preview}
              category={ticket.category}
              status={ticket.status}
              urgency={ticket.urgency}
              age={ticket.age}
              unread={ticket.unread}
              client={ticket.client}
              href={ticket.href}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export { AdminTicketsContent };
