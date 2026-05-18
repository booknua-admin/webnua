'use client';

import { useParams, useRouter } from 'next/navigation';

import { BookingActionBtn } from '@/components/shared/bookings/BookingActionBtn';
import { BookingHistoryRow } from '@/components/shared/bookings/BookingHistoryRow';
import { BookingJobGrid } from '@/components/shared/bookings/BookingJobGrid';
import { BookingNotesBox } from '@/components/shared/bookings/BookingNotesBox';
import { BookingSection } from '@/components/shared/bookings/BookingSection';
import { ClientBookingHero } from '@/components/shared/bookings/ClientBookingHero';
import { RescheduleBookingButton } from '@/components/shared/bookings/RescheduleBookingButton';
import { RailCard } from '@/components/shared/RailCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { voltlineBooking } from '@/lib/bookings/client-booking';
import { voltlineReschedule } from '@/lib/bookings/reschedule-modal';

function ClientBookingDetailContent() {
  const b = voltlineBooking;
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const completeHref = `/bookings/${id}/complete`;
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Calendar']} current="Booking" />
        }
      />
      <div className="px-10 py-10">
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

            <BookingSection heading="// NOTES FROM CUSTOMER" variant="inline">
              <BookingNotesBox>{b.notes}</BookingNotesBox>
            </BookingSection>

            <BookingSection
              heading="// HISTORY WITH THIS CUSTOMER"
              variant="inline"
            >
              <div className="flex flex-col gap-2">
                {b.history.map((h, i) => (
                  <BookingHistoryRow key={i} variant="compact" item={h} />
                ))}
              </div>
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
                    onClick = () => {
                      if (
                        window.confirm(
                          'Cancel this booking? The slot is freed on your calendar.',
                        )
                      ) {
                        router.push('/calendar');
                      }
                    };
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
            {b.nextNote ? (
              <RailCard heading="// NEXT">
                <div className="text-[13px] leading-[1.5] text-ink-soft [&_strong]:font-bold [&_strong]:text-ink">
                  {b.nextNote}
                </div>
              </RailCard>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export { ClientBookingDetailContent };
