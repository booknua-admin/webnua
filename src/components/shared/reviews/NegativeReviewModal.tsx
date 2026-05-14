'use client';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { NegativeReviewModalData } from '@/lib/reviews/types';

import { NegativeReviewActionRow } from './NegativeReviewActionRow';

type NegativeReviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NegativeReviewModalData;
};

function NegativeReviewModal({
  open,
  onOpenChange,
  data,
}: NegativeReviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <div className="mb-2 inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
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
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warn-soft text-[26px] font-extrabold text-warn">
              !
            </div>
          </div>

          <div className="my-4 rounded-md border-l-[3px] border-warn bg-warn-soft px-4.5 py-3.5">
            <div className="mb-1.5 text-[15px] font-bold text-warn">
              {data.quote.starsLabel}
            </div>
            <p className="mb-2 text-[14px] italic leading-[1.5] text-ink">
              &ldquo;{data.quote.text}&rdquo;
            </p>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet [&_strong]:text-ink">
              {data.quote.meta}
            </div>
          </div>

          <div className="mt-4.5">
            <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
              {data.actionsLabel}
            </div>
            <div className="flex flex-col gap-2">
              {data.actions.map((action) => (
                <NegativeReviewActionRow
                  key={action.id}
                  num={action.num}
                  title={action.title}
                  sub={action.sub}
                  recommended={action.recommended}
                />
              ))}
            </div>
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
              {data.dismissLabel}
            </Button>
            <Button
              variant="default"
              className="h-9"
              onClick={() => onOpenChange(false)}
            >
              {data.callLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { NegativeReviewModal };
export type { NegativeReviewModalProps };
