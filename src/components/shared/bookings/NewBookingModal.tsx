'use client';

import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { ChipSelector } from '@/components/shared/ChipSelector';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  NewBookingModalData,
  NewBookingToggleField,
} from '@/lib/bookings/new-booking-modal';

type NewBookingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NewBookingModalData;
};

function NewBookingModal({ open, onOpenChange, data }: NewBookingModalProps) {
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
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-rust"
              />
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {data.summary ? (
            <div className="mb-4.5 flex items-center gap-3.5 rounded-[10px] border border-rule bg-paper px-4.5 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink font-extrabold text-[14px] text-rust-light">
                {data.summary.initial}
              </div>
              <div className="flex-1 text-[13px] text-ink">
                {data.summary.headline}
                <span className="text-ink-quiet">{data.summary.detail}</span>
              </div>
            </div>
          ) : null}

          <FormRow label="Customer" required>
            <Input className="bg-paper" defaultValue={data.customer.value} readOnly />
            <p className="mt-1.5 text-[12px] text-ink-quiet">
              {data.customer.hint}
            </p>
          </FormRow>

          <div className="mb-4.5 grid grid-cols-2 gap-3.5">
            <FormRow label="Date" required compact>
              <Input className="bg-paper" defaultValue={data.date} readOnly />
            </FormRow>
            <FormRow label="Time" required compact>
              <Input className="bg-paper" defaultValue={data.time} readOnly />
            </FormRow>
          </div>

          <FormRow label="Service">
            <ChipSelector
              options={data.services}
              defaultId={data.defaultServiceId}
              variant="pill"
              layout="wrap"
            />
          </FormRow>

          <div className="mb-4.5 grid grid-cols-2 gap-3.5">
            <FormRow label="Quoted price" compact>
              <Input className="bg-paper" defaultValue={data.quotedPrice} />
            </FormRow>
            <FormRow label="Estimated duration" compact>
              <Input
                className="bg-paper"
                defaultValue={data.estimatedDuration}
              />
            </FormRow>
          </div>

          <FormRow label="Job notes">
            <Textarea
              className="min-h-20 bg-paper font-sans"
              defaultValue={data.jobNotes}
              readOnly
            />
          </FormRow>

          <div className="grid grid-cols-3 gap-3.5">
            <FormRow label="Assigned to" compact>
              <Input className="bg-paper" defaultValue={data.assignedTo} />
            </FormRow>
            {data.toggles.map((t) => (
              <ToggleField key={t.id} toggle={t} />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-paper-2 bg-paper px-7 py-4">
          <div className="flex-1 text-[12px] leading-[1.45] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {data.footerInfo}
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
              onClick={() => onOpenChange(false)}
            >
              Save booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type FormRowProps = {
  label: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
};

function FormRow({ label, required, compact, children }: FormRowProps) {
  return (
    <div className={cn('mb-4.5', compact && 'mb-0')}>
      <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
        {required ? <span className="text-rust"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function ToggleField({ toggle }: { toggle: NewBookingToggleField }) {
  const [on, setOn] = useState(toggle.defaultOn);
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {toggle.label}
      </label>
      <div className="flex items-center gap-2.5 py-1.5">
        <Switch checked={on} onCheckedChange={setOn} />
        <span
          className={cn(
            'text-[13px] font-semibold',
            on ? 'text-ink' : 'text-ink-quiet',
          )}
        >
          {on ? toggle.onText : toggle.offText}
        </span>
      </div>
    </div>
  );
}

export { NewBookingModal };
export type { NewBookingModalProps };
