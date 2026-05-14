'use client';

import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { ChipSelector } from '@/components/shared/ChipSelector';
import { RescheduleCompareCard } from '@/components/shared/bookings/RescheduleCompareCard';
import { RescheduleSmsPreview } from '@/components/shared/bookings/RescheduleSmsPreview';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type {
  RescheduleModalData,
  RescheduleToggleField,
} from '@/lib/bookings/reschedule-modal';

type RescheduleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: RescheduleModalData;
};

function RescheduleModal({ open, onOpenChange, data }: RescheduleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <div className="flex items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
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

        <div className="px-7 py-6">
          <div className="mb-4.5 grid grid-cols-2 gap-4.5">
            <RescheduleCompareCard tone="was" {...data.was} />
            <RescheduleCompareCard tone="now" {...data.now} />
          </div>

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

        <div className="flex items-center justify-between gap-3 border-t border-paper-2 bg-paper px-7 py-4">
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
              {data.saveLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
export type { RescheduleModalProps };
