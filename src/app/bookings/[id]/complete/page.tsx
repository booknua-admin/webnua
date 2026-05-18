'use client';

// =============================================================================
// /bookings/[id]/complete — the job completion flow (client Screen 11).
// Reached from the booking detail "Mark job complete" action. Confirming
// moves the booking to `completed` and routes to the dashboard. Payment
// capture + review-request automation arming wire up with their backends.
// =============================================================================

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { BookingSection } from '@/components/shared/bookings/BookingSection';
import { ChipSelector } from '@/components/shared/ChipSelector';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { voltlineJobCompletion } from '@/lib/bookings/job-completion';
import { useUpdateBookingStatus } from '@/lib/bookings/queries';
import { normalizeError } from '@/lib/errors';

export default function JobCompletionPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id ?? '');
  const backHref = `/bookings/${id}`;

  const c = voltlineJobCompletion;
  const [payment, setPayment] = useState(c.payment.defaultId);
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
      <div className="px-10 py-10">
        <div className="mx-auto flex max-w-[760px] flex-col gap-5">
          <PageHeader eyebrow={c.tag} title={c.title} subtitle={c.subtitle} />

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-rule bg-card px-8 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-[26px] text-good">
              {c.hero.icon}
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust">
              {c.hero.headline}
            </div>
            <p className="max-w-[520px] text-[14px] leading-[1.55] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
              {c.hero.body}
            </p>
          </div>

          <BookingSection heading="// JOB SUMMARY" variant="card">
            <div className="flex flex-col">
              {c.summary.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-dashed border-paper-2 py-2.5 text-[14px] last:border-b-0"
                >
                  <span className="text-ink-quiet">{row.label}</span>
                  <span
                    className={
                      row.accent
                        ? 'font-bold text-rust'
                        : 'font-semibold text-ink'
                    }
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </BookingSection>

          <BookingSection heading="// PAYMENT" variant="card">
            <ChipSelector
              options={c.payment.options}
              value={payment}
              onChange={setPayment}
              className="mb-3.5"
            />
            <p className="text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
              {c.payment.note}
            </p>
          </BookingSection>

          <div className="rounded-2xl border border-rust/30 bg-rust-soft/60 px-6 py-5">
            <div className="text-[15px] font-bold text-ink">
              {c.reviewTrigger.heading}
            </div>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">
              {c.reviewTrigger.description}
            </p>
            <p className="mt-3 rounded-lg border-l-2 border-rust bg-card px-4 py-3 text-[13px] italic leading-[1.5] text-ink-soft">
              {c.reviewTrigger.preview}
            </p>
            <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet [&_strong]:font-bold [&_strong]:text-rust">
              {c.reviewTrigger.meta}
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
        </div>
      </div>
    </>
  );
}
