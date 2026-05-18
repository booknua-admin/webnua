'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { ChipSelector } from '@/components/shared/ChipSelector';
import { CustomerPicker } from '@/components/shared/bookings/CustomerPicker';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBooking } from '@/lib/bookings/queries';
import { composeTimestamp } from '@/lib/bookings/time';
import type { SelectedCustomer } from '@/lib/customers/queries';
import { normalizeError } from '@/lib/errors';

const SERVICE_OPTIONS = [
  { id: 'standard', label: 'Standard' },
  { id: 'quick', label: 'Quick visit' },
  { id: 'quote', label: 'Quote required' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'one_off', label: 'One-off' },
  { id: 'custom', label: 'Custom' },
];

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

type NewBookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Client UUID the booking is created against. */
  clientId: string;
};

function NewBookingModal({ open, onOpenChange, clientId }: NewBookingModalProps) {
  const router = useRouter();
  const create = useCreateBooking();

  const [title, setTitle] = useState('');
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [date, setDate] = useState(todayValue);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [service, setService] = useState('standard');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');

  function reset() {
    setTitle('');
    setCustomer(null);
    setDate(todayValue());
    setStartTime('09:00');
    setEndTime('11:00');
    setService('standard');
    setPrice('');
    setNotes('');
    create.reset();
  }

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  const startsAt = date && startTime ? composeTimestamp(date, startTime) : null;
  const endsAt = date && endTime ? composeTimestamp(date, endTime) : null;
  const invalidRange =
    startsAt != null &&
    endsAt != null &&
    new Date(endsAt).getTime() <= new Date(startsAt).getTime();
  const canSave =
    title.trim().length > 0 &&
    customer != null &&
    startsAt != null &&
    endsAt != null &&
    !invalidRange &&
    !create.isPending;

  function handleSave() {
    if (!startsAt || !endsAt || !customer) return;
    const parsedPrice = price.trim() ? Number(price) : null;
    create.mutate(
      {
        clientId,
        customer,
        title: title.trim(),
        serviceType: service,
        startsAt,
        endsAt,
        price:
          parsedPrice != null && Number.isFinite(parsedPrice)
            ? parsedPrice
            : null,
        notes,
      },
      {
        onSuccess: ({ id }) => {
          onOpenChange(false);
          reset();
          router.push(`/bookings/${id}`);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rust" />
              NEW BOOKING
            </div>
            <DialogTitle className="mb-1.5 text-[24px] font-extrabold leading-[1.1] tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
              Add a <em>booking</em>
            </DialogTitle>
            <p className="text-[13px] leading-[1.45] text-ink-quiet">
              Manual booking — for jobs that didn&apos;t come through the
              funnel. Search for an existing customer, or add a new one.
            </p>
          </div>
          <DialogPrimitive.Close
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          <Field label="Job title" required>
            <Input
              className="bg-paper"
              placeholder="e.g. Ceiling fan + RCD replacement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label="Customer" required>
            <CustomerPicker
              clientId={clientId}
              value={customer}
              onChange={setCustomer}
            />
          </Field>

          <div className="mb-4.5 grid grid-cols-3 gap-3.5">
            <Field label="Date" required compact>
              <Input
                type="date"
                className="bg-paper"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Start time" required compact>
              <Input
                type="time"
                className="bg-paper"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Field>
            <Field label="End time" required compact>
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

          <Field label="Service">
            <ChipSelector
              options={SERVICE_OPTIONS}
              value={service}
              onChange={setService}
              variant="pill"
              layout="wrap"
            />
          </Field>

          <Field label="Quoted price">
            <Input
              type="number"
              min="0"
              step="1"
              className="bg-paper"
              placeholder="e.g. 220"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>

          <Field label="Job notes">
            <Textarea
              className="min-h-20 bg-paper font-sans"
              placeholder="Access notes, parts needed, anything the customer mentioned…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-2 bg-paper px-7 py-4">
          <div className="flex-1 text-[12px] leading-[1.45] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {create.error ? (
              <span className="font-semibold text-warn">
                {normalizeError(create.error).message}
              </span>
            ) : (
              <>
                The booking lands on the calendar straight away. <strong>
                  Reminders and confirmations are handled automatically.
                </strong>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="h-9"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="h-9"
              disabled={!canSave}
              onClick={handleSave}
            >
              {create.isPending ? 'Saving…' : 'Save booking'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type FieldProps = {
  label: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
};

function Field({ label, required, compact, children }: FieldProps) {
  return (
    <div className={compact ? 'mb-0' : 'mb-4.5'}>
      <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
        {required ? <span className="text-rust"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export { NewBookingModal };
export type { NewBookingModalProps };
