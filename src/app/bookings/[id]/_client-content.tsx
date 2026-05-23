'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { GbpSendRequestButton } from '@/components/shared/gbp/GbpSendRequestButton';
import { BookingActionBtn } from '@/components/shared/bookings/BookingActionBtn';
import { BookingHistoryRow } from '@/components/shared/bookings/BookingHistoryRow';
import { BookingJobGrid } from '@/components/shared/bookings/BookingJobGrid';
import { BookingNotesBox } from '@/components/shared/bookings/BookingNotesBox';
import { BookingSection } from '@/components/shared/bookings/BookingSection';
import { ClientBookingHero } from '@/components/shared/bookings/ClientBookingHero';
import { EditJobNotesModal } from '@/components/shared/bookings/EditJobNotesModal';
import { RescheduleBookingButton } from '@/components/shared/bookings/RescheduleBookingButton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { RailCard } from '@/components/shared/RailCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  useClientBookingDetail,
  useUpdateBookingStatus,
} from '@/lib/bookings/queries';
import { voltlineReschedule } from '@/lib/bookings/reschedule-modal';
import { normalizeError } from '@/lib/errors';

function ClientBookingDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const completeHref = `/bookings/${id}/complete`;
  const { data: b, isLoading, error } = useClientBookingDetail(id ?? '');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const cancelBooking = useUpdateBookingStatus();

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Calendar']} current="Booking" />
        }
      />
      <div className="px-10 py-10">
        {isLoading ? (
          <DetailNotice>{'// Loading booking…'}</DetailNotice>
        ) : error || !b ? (
          <DetailNotice>
            {`// ${error ? normalizeError(error).message : 'Booking not found'}`}
          </DetailNotice>
        ) : (
          <>
            <ClientBookingHero
              tag={b.tag}
              title={b.title}
              meta={b.meta}
              statusLabel={b.statusLabel}
            />

            <div className="grid grid-cols-[1.4fr_1fr] items-start gap-5.5">
              <div className="rounded-[12px] border border-rule bg-card px-7 py-6">
                <BookingSection heading="// CUSTOMER" variant="inline">
                  <div className="grid grid-cols-[52px_1fr] items-center gap-4">
                    <div className="flex h-13 w-13 items-center justify-center rounded-full bg-paper-2 text-[18px] font-extrabold text-ink">
                      {b.customer.initial}
                    </div>
                    <div>
                      <div className="mb-1 text-[18px] font-extrabold tracking-[-0.02em] text-ink">
                        {b.customer.name}
                      </div>
                      <div className="text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
                        {b.customer.contact}
                      </div>
                    </div>
                  </div>
                </BookingSection>

                <BookingSection heading="// JOB" variant="inline">
                  <BookingJobGrid cells={b.job} surface="paper" />
                </BookingSection>

                <BookingSection
                  heading="// NOTES FROM CUSTOMER"
                  variant="inline"
                >
                  <BookingNotesBox>{b.notes}</BookingNotesBox>
                </BookingSection>

                <BookingSection
                  heading="// HISTORY WITH THIS CUSTOMER"
                  variant="inline"
                >
                  {b.history.length === 0 ? (
                    <p className="text-[13px] text-ink-quiet">
                      First booking with this customer.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {b.history.map((h, i) => (
                        <BookingHistoryRow key={i} variant="compact" item={h} />
                      ))}
                    </div>
                  )}
                </BookingSection>
              </div>

              <div className="sticky top-[100px] flex flex-col gap-3">
                {b.actions.map((group) => (
                  <RailCard key={group.heading} heading={group.heading}>
                    {group.actions.map((a, i) => {
                      if (a.label === 'Reschedule') {
                        return (
                          <RescheduleBookingButton
                            key={i}
                            booking={{
                              id: b.id,
                              startsAt: b.startsAt,
                              endsAt: b.endsAt,
                            }}
                            data={voltlineReschedule}
                            label={a.label}
                            variant="action-row"
                            icon={a.icon}
                          />
                        );
                      }
                      let href = a.href;
                      let onClick: (() => void) | undefined;
                      if (a.label === 'Mark job complete') {
                        href = completeHref;
                      } else if (a.label.startsWith('Call ')) {
                        href = `tel:${b.customer.phone.replace(/\s+/g, '')}`;
                      } else if (a.label === 'Cancel booking') {
                        onClick = () => setCancelOpen(true);
                      } else if (a.label === 'Edit job notes') {
                        onClick = () => setNotesOpen(true);
                      }
                      return (
                        <BookingActionBtn
                          key={i}
                          icon={a.icon}
                          label={a.label}
                          tone={a.tone ?? 'secondary'}
                          href={href}
                          onClick={onClick}
                        />
                      );
                    })}
                  </RailCard>
                ))}
                <RailCard heading="// AFTER THE JOB">
                  <GbpSendRequestButton
                    context={{
                      clientId: b.gbpContext.clientId,
                      recipientName: b.gbpContext.recipientName,
                      recipientPhone: b.gbpContext.recipientPhone,
                      recipientEmail: b.gbpContext.recipientEmail,
                      leadId: b.gbpContext.leadId,
                      bookingId: b.gbpContext.bookingId,
                    }}
                    variant="action-row"
                    icon="★"
                    label="Send review request"
                  />
                </RailCard>
                {b.nextNote ? (
                  <RailCard heading="// NEXT">
                    <div className="text-[13px] leading-[1.5] text-ink-soft [&_strong]:font-bold [&_strong]:text-ink">
                      {b.nextNote}
                    </div>
                  </RailCard>
                ) : null}
              </div>
            </div>

            <ConfirmDialog
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              title="Cancel this booking?"
              description="The slot is freed on your calendar and the customer is notified."
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
            {notesOpen ? (
              <EditJobNotesModal
                open
                onOpenChange={setNotesOpen}
                initialNotes={b.notesText}
                onSave={(notes) =>
                  console.log('[stub] job notes saved', { id, notes })
                }
              />
            ) : null}
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

export { ClientBookingDetailContent };
