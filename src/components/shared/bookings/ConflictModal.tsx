'use client';

import { useState } from 'react';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { ConflictCard } from '@/components/shared/bookings/ConflictCard';
import { ConflictOptionRow } from '@/components/shared/bookings/ConflictOptionRow';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { ConflictModalData } from '@/lib/bookings/conflict-modal';

type ConflictModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ConflictModalData;
  /** Where the primary action sends the user when saved. */
  onSaveHref?: string;
};

function ConflictModal({
  open,
  onOpenChange,
  data,
  onSaveHref,
}: ConflictModalProps) {
  const [selectedId, setSelectedId] = useState(data.defaultOptionId);

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
            <DialogTitle className="mb-1.5 text-[22px] font-extrabold leading-[1.15] tracking-[-0.025em] text-ink [&_em]:not-italic [&_em]:text-rust">
              {data.title}
            </DialogTitle>
            <p className="text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
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
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-warn-soft text-[26px] font-black text-warn">
            ⚠
          </div>

          <div className="my-4 grid grid-cols-2 gap-3">
            <ConflictCard tone="attempted" {...data.attempted} />
            <ConflictCard tone="existing" {...data.existing} />
          </div>

          <p className="mt-3.5 text-[13px] leading-[1.5] text-ink-quiet [&_strong]:text-ink">
            {data.explainer}
          </p>

          <div className="mt-4.5">
            {data.options.map((o) => (
              <ConflictOptionRow
                key={o.id}
                num={o.num}
                title={o.title}
                sub={o.sub}
                selected={o.id === selectedId}
                onClick={() => setSelectedId(o.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-paper-2 bg-paper px-7 py-4">
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => onOpenChange(false)}
          >
            ← Back
          </Button>
          <Button
            variant="secondary"
            className="h-9"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {onSaveHref ? (
            <Button
              variant="default"
              className="h-9"
              asChild
            >
              <a href={onSaveHref}>{data.saveLabel}</a>
            </Button>
          ) : (
            <Button
              variant="default"
              className="h-9"
              onClick={() => onOpenChange(false)}
            >
              {data.saveLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ConflictModal };
export type { ConflictModalProps };
