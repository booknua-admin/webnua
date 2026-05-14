'use client';

import { useState } from 'react';

import { NewBookingModal } from '@/components/shared/bookings/NewBookingModal';
import { Button } from '@/components/ui/button';
import type { NewBookingModalData } from '@/lib/bookings/new-booking-modal';

type AddBookingButtonProps = {
  data: NewBookingModalData;
  /** Override the button label; defaults to "+ New booking". */
  label?: string;
};

function AddBookingButton({
  data,
  label = '+ New booking',
}: AddBookingButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" className="h-9" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <NewBookingModal open={open} onOpenChange={setOpen} data={data} />
    </>
  );
}

export { AddBookingButton };
export type { AddBookingButtonProps };
