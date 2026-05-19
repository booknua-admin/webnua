'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DangerRowProps = {
  heading: string;
  description: React.ReactNode;
  action: {
    label: string;
    solid?: boolean;
    /** Neutral = ink-bordered (e.g. export, transfer); destructive = warn-bordered. */
    tone?: 'neutral' | 'destructive';
  };
  /** Real handler fired on confirm. Omitted = stub (dialog just dismisses). */
  onConfirm?: () => void;
  /** Disables the action button (e.g. no client selected). */
  disabled?: boolean;
  className?: string;
};

function DangerRow({
  heading,
  description,
  action,
  onConfirm,
  disabled,
  className,
}: DangerRowProps) {
  const tone = action.tone ?? 'destructive';
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div
      data-slot="danger-row"
      className={cn(
        'mb-3 grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border bg-warn-soft px-[22px] py-4',
        'border-warn',
        className,
      )}
    >
      <div>
        <div className="mb-1 text-[15px] font-extrabold text-warn">{heading}</div>
        <div className="max-w-[480px] text-[13px] leading-[1.45] text-ink-soft [&_strong]:font-semibold [&_strong]:text-ink">
          {description}
        </div>
      </div>
      {action.solid ? (
        <Button
          variant="destructive"
          size="sm"
          disabled={disabled}
          onClick={() => setConfirmOpen(true)}
        >
          {action.label}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            tone === 'destructive'
              ? 'border-warn text-warn hover:bg-warn hover:text-paper'
              : 'border-ink text-ink hover:bg-ink hover:text-paper',
          )}
          onClick={() => setConfirmOpen(true)}
        >
          {action.label}
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${heading}?`}
        description={description}
        confirmLabel={action.label}
        cancelLabel="Cancel"
        tone={tone === 'destructive' ? 'destructive' : 'default'}
        onConfirm={onConfirm ?? (() => {})}
      />
    </div>
  );
}

export { DangerRow };
