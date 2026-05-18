'use client';

// =============================================================================
// CreateClientButton — a button that opens the CreateClientModal. Same
// trigger-owns-modal-state pattern as AddBookingButton etc.
// =============================================================================

import { useState } from 'react';

import { CreateClientModal } from '@/components/admin/CreateClientModal';
import { Button } from '@/components/ui/button';

export function CreateClientButton({
  label = '+ New client',
  variant = 'default',
}: {
  label?: string;
  variant?: 'default' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <CreateClientModal open={open} onOpenChange={setOpen} />
    </>
  );
}
