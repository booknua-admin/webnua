'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { AdminBookingHero } from '@/components/shared/bookings/AdminBookingHero';
import { BookingHistoryRow } from '@/components/shared/bookings/BookingHistoryRow';
import { BookingJobGrid } from '@/components/shared/bookings/BookingJobGrid';
import { BookingNotesBox } from '@/components/shared/bookings/BookingNotesBox';
import { BookingSection } from '@/components/shared/bookings/BookingSection';
import { RescheduleBookingButton } from '@/components/shared/bookings/RescheduleBookingButton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { GbpSendRequestButton } from '@/components/shared/gbp/GbpSendRequestButton';
import { PageHeader } from '@/components/shared/PageHeader';
import { RailCard } from '@/components/shared/RailCard';
import { RailPropertyRow } from '@/components/shared/RailPropertyRow';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  useAdminBookingDetail,
  useUpdateBookingStatus,
} from '@/lib/bookings/queries';
import { freshhomeReschedule } from '@/lib/bookings/reschedule-modal';
import { normalizeError } from '@/lib/errors';

function AdminBookingDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const completeHref = `/bookings/${id}/complete`;
  const { data: b, isLoading, error } = useAdminBookingDetail(id ?? '');
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancelBooking = useUpdateBookingStatus();

  const mapsUrl = b
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        b.location.address.replace(/\s·\s/g, ', '),
      )}`
    : '#';

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Calendar']} current="Booking" />
        }
      />
      <div className="flex flex-col gap-3.5 px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <DetailNotice>{'// Loading booking…'}</DetailNotice>
        ) : error || !b ? (
          <DetailNotice>
            {`// ${error ? normalizeError(error).message : 'Booking not found'}`}
          </DetailNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={b.hero.eyebrow}
              title={b.hero.title}
              subtitle={b.hero.subtitle}
            />

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-3.5">
                <AdminBookingHero
                  tone={b.tone}
                  timeRow={b.timeRow}
                  jobTitle={b.jobTitle}
                  customer={b.customer}
                  actions={
                    <>
                      <Button variant="default" className="h-9" asChild>
                        <Link href={completeHref}>Mark complete</Link>
                      </Button>
                      <RescheduleBookingButton
                        booking={{
                          id: b.id,
                          startsAt: b.startsAt,
                          endsAt: b.endsAt,
                        }}
                        data={freshhomeReschedule}
                      />
                      <GbpSendRequestButton
                        context={{
                          clientId: b.gbpContext.clientId,
                          recipientName: b.gbpContext.recipientName,
                          recipientPhone: b.gbpContext.recipientPhone,
                          recipientEmail: b.gbpContext.recipientEmail,
                          leadId: b.gbpContext.leadId,
                          bookingId: b.gbpContext.bookingId,
                        }}
                        variant="ghost"
                        icon="★"
                        label="Send review request"
                      />
                      <Button variant="secondary" className="h-9" asChild>
                        <Link href="/leads">Open leads →</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-9"
                        onClick={() => setCancelOpen(true)}
                      >
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
                  {b.history.length === 0 ? (
                    <p className="text-[13px] text-ink-quiet">
                      No previous bookings for this customer.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {b.history.map((h, i) => (
                        <BookingHistoryRow key={i} variant="grid" item={h} />
                      ))}
                    </div>
                  )}
                </BookingSection>
              </div>

              <div className="sticky top-[100px] flex flex-col gap-3.5">
                <RailCard heading="// CUSTOMER VALUE">
                  {b.customerValue.map((row, i) => (
                    <RailPropertyRow
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
                </RailCard>

                <RailCard heading="// LOCATION">
                  <div className="relative mb-3 flex h-[140px] items-center justify-center rounded-lg border border-rule-soft bg-paper text-ink-quiet">
                    <span aria-hidden className="text-[24px] text-rust">
                      ⊕
                    </span>
                    <span className="absolute bottom-2 left-3 text-[11px] text-ink-soft">
                      {b.location.address}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    className="h-9 w-full text-[12px]"
                    asChild
                  >
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      Open in Maps ↗
                    </a>
                  </Button>
                </RailCard>

                <RailCard heading="// AUTOMATIONS">
                  {b.automations.map((row, i) => (
                    <RailPropertyRow
                      key={i}
                      label={row.label}
                      value={row.value}
                    />
                  ))}
                </RailCard>
              </div>
            </div>

            <ConfirmDialog
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              title="Cancel this booking?"
              description="The slot is freed on the calendar and the customer is notified."
              confirmLabel="Cancel booking"
              cancelLabel="Keep booking"
              tone="destructive"
              onConfirm={() =>
                cancelBooking.mutate(
                  { bookingId: id, status: 'cancelled' },
                  { onSuccess: () => router.push('/calendar') },
                )
              }
            />
          </>
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

export { AdminBookingDetailContent };
