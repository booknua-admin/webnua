'use client';

// =============================================================================
// /bookings/[id]/complete — the job completion flow (client Screen 11).
// Reached from the booking detail "Mark job complete" action. The job summary
// is read live from the booking (`useClientBookingDetail`) — no per-client
// stub. Confirming moves the booking to `completed` and routes to the
// dashboard. Payment capture + review-request automation arming wire up with
// their backends (Phase 7/8).
// =============================================================================

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { BookingSection } from '@/components/shared/bookings/BookingSection';
import { ChipSelector } from '@/components/shared/ChipSelector';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useClientBookingDetail, useUpdateBookingStatus } from '@/lib/bookings/queries';
import { normalizeError } from '@/lib/errors';

const PAYMENT_OPTIONS = [
  { id: 'card', label: 'Paid on site · card' },
  { id: 'cash', label: 'Paid on site · cash' },
  { id: 'invoice-7', label: 'Invoice (Net 7)' },
  { id: 'invoice-14', label: 'Invoice (Net 14)' },
];

export default function JobCompletionPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const backHref = `/bookings/${id}`;

  const { data: booking, isLoading, isError } = useClientBookingDetail(id);
  const [payment, setPayment] = useState(PAYMENT_OPTIONS[0].id);
  const updateStatus = useUpdateBookingStatus();

  const complete = () => {
    if (updateStatus.isPending) return;
    updateStatus.mutate(
      { bookingId: id, status: 'completed' },
      { onSuccess: () => router.push('/dashboard') },
    );
  };

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Calendar', 'Booking']} current="Complete" />
        }
      />
      <div className="px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto flex max-w-[760px] flex-col gap-5">
          <PageHeader
            eyebrow="// Job completion"
            title={
              <>
                Mark this <em>complete</em>?
              </>
            }
            subtitle={
              <>
                Confirms the job is done, captures payment, and{' '}
                <strong>arms the review request automation</strong>.
              </>
            }
          />

          {isLoading ? (
            <Notice>{'// Loading booking…'}</Notice>
          ) : isError || !booking ? (
            <Notice tone="warn">{'// Booking not found in your workspace'}</Notice>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-rule bg-card px-8 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-[26px] text-good">
                  ✓
                </div>
                <div className="text-[22px] font-extrabold tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust">
                  {booking.title} · <em>{booking.meta.price}</em>
                </div>
                <p className="max-w-[520px] text-[14px] leading-[1.55] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
                  <strong>
                    {booking.meta.customer} · {booking.meta.suburb}.
                  </strong>{' '}
                  Marking this complete saves the job, queues the invoice, and
                  triggers your review request automation.
                </p>
              </div>

              <BookingSection heading="// JOB SUMMARY" variant="card">
                <div className="flex flex-col">
                  <SummaryRow label="Customer" value={booking.meta.customer} />
                  <SummaryRow label="Duration" value={booking.meta.duration} />
                  {booking.job.map((cell) => (
                    <SummaryRow
                      key={cell.label}
                      label={cell.label}
                      value={cell.value}
                    />
                  ))}
                  <SummaryRow label="Final total" value={booking.meta.price} accent />
                </div>
              </BookingSection>

              <BookingSection heading="// PAYMENT" variant="card">
                <ChipSelector
                  options={PAYMENT_OPTIONS}
                  value={payment}
                  onChange={setPayment}
                  className="mb-3.5"
                />
                <p className="text-[13px] leading-[1.5] text-ink-quiet">
                  How the customer settled. Webnua records this against the job
                  once payments are wired up.
                </p>
              </BookingSection>

              <div className="rounded-2xl border border-rust/30 bg-rust-soft/60 px-6 py-5">
                <div className="text-[15px] font-bold text-ink">
                  Review request fires after completion
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">
                  When you confirm, the{' '}
                  <strong>review request automation</strong> arms — the customer
                  gets a friendly SMS asking for a Google review, with one
                  follow-up if there&apos;s no response.
                </p>
              </div>

              {updateStatus.isError ? (
                <p className="text-right text-[13px] text-warn">
                  {normalizeError(updateStatus.error).message}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2.5">
                <Button variant="ghost" asChild>
                  <Link href={backHref}>← Back to booking</Link>
                </Button>
                <Button
                  variant="secondary"
                  onClick={complete}
                  disabled={updateStatus.isPending}
                >
                  Complete without review request
                </Button>
                <Button onClick={complete} disabled={updateStatus.isPending}>
                  {updateStatus.isPending
                    ? 'Completing…'
                    : 'Confirm complete + send review request →'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-paper-2 py-2.5 text-[14px] last:border-b-0">
      <span className="text-ink-quiet">{label}</span>
      <span className={accent ? 'font-bold text-rust' : 'font-semibold text-ink'}>
        {value}
      </span>
    </div>
  );
}

function Notice({
  children,
  tone = 'quiet',
}: {
  children: React.ReactNode;
  tone?: 'quiet' | 'warn';
}) {
  return (
    <p
      className={`rounded-xl border border-rule bg-card px-5 py-10 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
        tone === 'warn' ? 'text-warn' : 'text-ink-quiet'
      }`}
    >
      {children}
    </p>
  );
}
