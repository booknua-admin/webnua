'use client';

import { useState } from 'react';

import { RescheduleModal } from '@/components/shared/bookings/RescheduleModal';
import { Button } from '@/components/ui/button';
import { freshhomeReschedule } from '@/lib/bookings/reschedule-modal';

function RescheduleBookingButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        Reschedule
      </Button>
      <RescheduleModal
        open={open}
        onOpenChange={setOpen}
        data={freshhomeReschedule}
      />
    </>
  );
}

export { RescheduleBookingButton };
