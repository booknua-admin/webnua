'use client';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { AutomationTestSendData } from '@/lib/automations/types';

type AutomationTestSendModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AutomationTestSendData;
};

function AutomationTestSendModal({
  open,
  onOpenChange,
  data,
}: AutomationTestSendModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
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
            <p className="text-[13px] leading-[1.45] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
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
          <FormRow label="Send to">
            <Input
              className="bg-paper"
              defaultValue={data.sendTo}
              readOnly
              aria-label="Test send recipient"
            />
            <p className="mt-1.5 text-[12px] text-ink-quiet">
              {data.sendToHint}
            </p>
          </FormRow>

          <FormRow label="Preview · how the SMS will arrive">
            <div
              data-slot="test-send-preview"
              className="rounded-[14px] bg-[#e7f3ff] px-4.5 pb-6 pt-4.5"
            >
              <div className="mb-3 text-center font-mono text-[11px] font-semibold text-ink-quiet">
                {data.phoneBar}
              </div>
              <div
                data-slot="test-send-sms"
                className="relative max-w-[320px] rounded-[18px] bg-card px-4 py-3 font-sans text-[13px] leading-[1.45] text-ink shadow-[0_2px_6px_rgba(0,0,0,0.05)]"
              >
                {data.smsPreview}
              </div>
              <div className="mt-3 font-mono text-[10px] tracking-[0.06em] text-ink-quiet [&_[data-slot=var-list]]:font-bold [&_[data-slot=var-list]]:text-rust">
                {data.smsVariablesLine}
              </div>
            </div>
          </FormRow>

          <FormRow label="Test options" last>
            <div
              data-slot="test-send-options"
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[10px] bg-paper px-4 py-3.5"
            >
              <div className="font-sans text-[13px] text-ink [&_strong]:font-bold">
                {data.options.title}
                <span className="mt-0.5 block text-[11px] text-ink-quiet">
                  {data.options.sub}
                </span>
              </div>
              <Button variant="secondary" type="button">
                {data.options.switchLabel}
              </Button>
            </div>
          </FormRow>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-paper-2 bg-paper px-7 py-4">
          <div className="font-sans text-[12px] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {data.footerInfo}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              {data.cancelLabel}
            </Button>
            <Button type="button" onClick={() => onOpenChange(false)}>
              {data.sendLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? '' : 'mb-4.5'}>
      <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </div>
      {children}
    </div>
  );
}

export { AutomationTestSendModal };
export type { AutomationTestSendModalProps };
