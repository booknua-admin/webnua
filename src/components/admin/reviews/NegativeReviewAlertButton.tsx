'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { NegativeReviewModalData } from '@/lib/reviews/types';

import { NegativeReviewModal } from './NegativeReviewModal';

type NegativeReviewAlertButtonProps = {
  data: NegativeReviewModalData;
};

/**
 * Stub trigger for the negative-review modal on admin `/reviews`. In the real
 * build the modal fires from a low-rating webhook; for the stub layer it
 * lives as a button on the page header so the modal is reachable.
 */
function NegativeReviewAlertButton({ data }: NegativeReviewAlertButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        ⚠ {data.triggerLabel}
      </Button>
      <NegativeReviewModal open={open} onOpenChange={setOpen} data={data} />
    </>
  );
}

export { NegativeReviewAlertButton };
export type { NegativeReviewAlertButtonProps };
