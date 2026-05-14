'use client';

import { useState } from 'react';

import { RescheduleModal } from '@/components/shared/bookings/RescheduleModal';
import { Button } from '@/components/ui/button';
import type { RescheduleModalData } from '@/lib/bookings/reschedule-modal';

type RescheduleBookingButtonProps = {
  data: RescheduleModalData;
  /** Override the trigger label; defaults to "Reschedule". */
  label?: string;
  /** Render as a `secondary` Button (admin hero) or a `BookingActionBtn`-style
   *  ghost row (client rail). Default: `button`. */
  variant?: 'button' | 'action-row';
  /** Glyph for the `action-row` variant. */
  icon?: string;
};

function RescheduleBookingButton({
  data,
  label = 'Reschedule',
  variant = 'button',
  icon = '▤',
}: RescheduleBookingButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === 'button' ? (
        <Button
          variant="secondary"
          className="h-9"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mb-2 flex w-full items-center gap-2.5 rounded-lg border border-rule bg-paper px-3.5 py-2.5 text-left text-[13px] font-semibold text-ink transition-colors last:mb-0 hover:border-ink hover:bg-ink hover:text-paper"
        >
          <span aria-hidden className="w-[18px] text-center font-mono">
            {icon}
          </span>
          {label}
        </button>
      )}
      <RescheduleModal open={open} onOpenChange={setOpen} data={data} />
    </>
  );
}

export { RescheduleBookingButton };
export type { RescheduleBookingButtonProps };
