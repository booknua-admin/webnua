import { AdminBookingHero } from '@/components/shared/bookings/AdminBookingHero';
import { BookingHistoryRow } from '@/components/shared/bookings/BookingHistoryRow';
import { BookingJobGrid } from '@/components/shared/bookings/BookingJobGrid';
import { BookingNotesBox } from '@/components/shared/bookings/BookingNotesBox';
import { BookingSection } from '@/components/shared/bookings/BookingSection';
import { RescheduleBookingButton } from '@/components/shared/bookings/RescheduleBookingButton';
import { freshhomeReschedule } from '@/lib/bookings/reschedule-modal';
import { PageHeader } from '@/components/shared/PageHeader';
import { TicketPropertyRow } from '@/components/shared/tickets/TicketPropertyRow';
import { TicketSideCard } from '@/components/shared/tickets/TicketSideCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { freshhomeBooking } from '@/lib/bookings/admin-booking';

function AdminBookingDetailContent() {
  const b = freshhomeBooking;
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Calendar']} current="Booking" />
        }
      />
      <div className="flex flex-col gap-3.5 px-10 py-10">
        <PageHeader
          eyebrow={b.hero.eyebrow}
          title={b.hero.title}
          subtitle={b.hero.subtitle}
        />

        <div className="grid grid-cols-[1fr_320px] items-start gap-6">
          <div className="flex flex-col gap-3.5">
            <AdminBookingHero
              tone={b.tone}
              timeRow={b.timeRow}
              jobTitle={b.jobTitle}
              customer={b.customer}
              actions={
                <>
                  <Button variant="default" className="h-9">
                    Mark complete
                  </Button>
                  <RescheduleBookingButton data={freshhomeReschedule} />
                  <Button variant="secondary" className="h-9" asChild>
                    <a href="/leads/larsen">Open lead →</a>
                  </Button>
                  <Button variant="ghost" className="h-9">
                    Cancel booking
                  </Button>
                </>
              }
            />

            <BookingSection heading="// JOB DETAILS">
              <BookingJobGrid cells={b.details} surface="plain" />
            </BookingSection>

            <BookingSection heading="// CUSTOMER NOTES">
              <BookingNotesBox>{b.notes}</BookingNotesBox>
            </BookingSection>

            <BookingSection heading={b.historyHeading}>
              <div className="flex flex-col gap-1.5">
                {b.history.map((h, i) => (
                  <BookingHistoryRow key={i} variant="grid" item={h} />
                ))}
              </div>
            </BookingSection>
          </div>

          <div className="sticky top-[100px] flex flex-col gap-3.5">
            <TicketSideCard heading="// CUSTOMER VALUE">
              {b.customerValue.map((row, i) => (
                <TicketPropertyRow
                  key={i}
                  label={row.label}
                  value={
                    row.accent ? (
                      <span className="text-rust">{row.value}</span>
                    ) : (
                      row.value
                    )
                  }
                />
              ))}
            </TicketSideCard>

            <TicketSideCard heading="// LOCATION">
              <div className="relative mb-3 flex h-[140px] items-center justify-center rounded-lg border border-rule-soft bg-paper text-ink-quiet">
                <span aria-hidden className="text-[24px] text-rust">
                  ⊕
                </span>
                <span className="absolute bottom-2 left-3 text-[11px] text-ink-soft">
                  {b.location.address}
                </span>
              </div>
              <Button variant="secondary" className="h-9 w-full text-[12px]">
                Open in Maps ↗
              </Button>
            </TicketSideCard>

            <TicketSideCard heading="// AUTOMATIONS">
              {b.automations.map((row, i) => (
                <TicketPropertyRow key={i} label={row.label} value={row.value} />
              ))}
            </TicketSideCard>
          </div>
        </div>
      </div>
    </>
  );
}

export { AdminBookingDetailContent };
