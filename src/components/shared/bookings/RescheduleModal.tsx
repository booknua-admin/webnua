'use client';

import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { ChipSelector } from '@/components/shared/ChipSelector';
import { RescheduleCompareCard } from '@/components/shared/bookings/RescheduleCompareCard';
import { RescheduleSmsPreview } from '@/components/shared/bookings/RescheduleSmsPreview';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useRescheduleBooking } from '@/lib/bookings/queries';
import {
  composeTimestamp,
  formatDayLabel,
  formatTimeRange,
  isoToDateValue,
  isoToTimeValue,
} from '@/lib/bookings/time';
import { normalizeError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import type {
  RescheduleModalData,
  RescheduleToggleField,
} from '@/lib/bookings/reschedule-modal';

type RescheduleTarget = {
  id: string;
  startsAt: string;
  endsAt: string;
};

type RescheduleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The booking being rescheduled — seeds the date/time inputs. */
  booking: RescheduleTarget;
  data: RescheduleModalData;
};

function RescheduleModal({
  open,
  onOpenChange,
  booking,
  data,
}: RescheduleModalProps) {
  const [date, setDate] = useState(() => isoToDateValue(booking.startsAt));
  const [startTime, setStartTime] = useState(() =>
    isoToTimeValue(booking.startsAt),
  );
  const [endTime, setEndTime] = useState(() => isoToTimeValue(booking.endsAt));

  const reschedule = useRescheduleBooking();

  const nextStartsAt = date && startTime ? composeTimestamp(date, startTime) : null;
  const nextEndsAt = date && endTime ? composeTimestamp(date, endTime) : null;

  const unchanged =
    nextStartsAt === booking.startsAt && nextEndsAt === booking.endsAt;
  const invalidRange =
    nextStartsAt != null &&
    nextEndsAt != null &&
    new Date(nextEndsAt).getTime() <= new Date(nextStartsAt).getTime();
  const canSave =
    nextStartsAt != null &&
    nextEndsAt != null &&
    !invalidRange &&
    !unchanged &&
    !reschedule.isPending;

  function handleSave() {
    if (!nextStartsAt || !nextEndsAt) return;
    reschedule.mutate(
      { bookingId: booking.id, startsAt: nextStartsAt, endsAt: nextEndsAt },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rust" />
              {data.tag}
            </div>
            <DialogTitle className="mb-1.5 text-[24px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
              {data.title}
            </DialogTitle>
            <p className="text-[13px] leading-[1.45] text-ink-quiet">
              {data.subtitle}
            </p>
          </div>
          <DialogPrimitive.Close
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <div className="mb-4.5 grid grid-cols-2 gap-4.5">
            <RescheduleCompareCard
              tone="was"
              tag="// WAS BOOKED"
              time={formatTimeRange(booking.startsAt, booking.endsAt)}
              day={formatDayLabel(booking.startsAt)}
            />
            <RescheduleCompareCard
              tone="now"
              tag="// NEW TIME"
              time={
                nextStartsAt && nextEndsAt
                  ? formatTimeRange(nextStartsAt, nextEndsAt)
                  : '—'
              }
              day={nextStartsAt ? formatDayLabel(nextStartsAt) : 'Pick a date'}
            />
          </div>

          <div className="mb-4.5 grid grid-cols-3 gap-3.5">
            <Field label="New date">
              <Input
                type="date"
                className="bg-paper"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Start time">
              <Input
                type="time"
                className="bg-paper"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Field label="End time">
              <Input
                type="time"
                className="bg-paper"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </Field>
          </div>

          {invalidRange ? (
            <p className="mb-4 text-[12px] font-semibold text-warn">
              The end time must be after the start time.
            </p>
          ) : null}

          <div className="mb-4.5">
            <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
              Reason (sent to customer if not silent)
            </label>
            <ChipSelector
              options={data.reasons}
              defaultId={data.defaultReasonId}
              variant="pill"
              layout="wrap"
            />
          </div>

          <RescheduleSmsPreview
            heading="PREVIEW · SMS TO CUSTOMER"
            tokens={data.smsPreview}
            className="mb-3"
          />

          <div className="grid grid-cols-2 gap-3.5">
            {data.toggles.map((t) => (
              <RescheduleToggleRow key={t.id} toggle={t} />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-2 bg-paper px-7 py-4">
          <div className="flex-1 text-[12px] leading-[1.45] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {reschedule.error
              ? normalizeError(reschedule.error).message
              : data.footerInfo}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="h-9"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="h-9"
              disabled={!canSave}
              onClick={handleSave}
            >
              {reschedule.isPending ? 'Saving…' : data.saveLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </label>
      {children}
    </div>
  );
}

function RescheduleToggleRow({ toggle }: { toggle: RescheduleToggleField }) {
  const [on, setOn] = useState(toggle.defaultOn);
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Switch checked={on} onCheckedChange={setOn} />
      <span
        className={cn(
          'text-[13px] font-semibold',
          on ? 'text-ink' : 'text-ink-quiet',
        )}
      >
        {toggle.label}
      </span>
    </div>
  );
}

export { RescheduleModal };
export type { RescheduleModalProps, RescheduleTarget };
