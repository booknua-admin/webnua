'use client';

import { useState } from 'react';

import { NewBookingModal } from '@/components/shared/bookings/NewBookingModal';
import { Button } from '@/components/ui/button';
import { freshhomeNewBooking } from '@/lib/bookings/new-booking-modal';

function AddBookingButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        + New booking
      </Button>
      <NewBookingModal
        open={open}
        onOpenChange={setOpen}
        data={freshhomeNewBooking}
      />
    </>
  );
}

export { AddBookingButton };
