'use client';

import { useState } from 'react';

import { NewBookingModal } from '@/components/shared/bookings/NewBookingModal';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { useClientId } from '@/lib/clients/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

type AddBookingButtonProps = {
  /** Override the button label; defaults to "+ New booking". */
  label?: string;
};

/** Opens the new-booking modal. A booking always belongs to one client: a
 *  client-role user books against their own client; an operator books against
 *  the active sub-account — so in agency mode the button is disabled until a
 *  client is picked from the sidebar. */
function AddBookingButton({ label = '+ New booking' }: AddBookingButtonProps) {
  const [open, setOpen] = useState(false);
  const user = useUser();
  const { activeClientId } = useWorkspace();

  const clientSlug =
    user?.role === 'admin' ? activeClientId : (user?.clientId ?? null);
  const { data: clientId } = useClientId(clientSlug);

  if (clientSlug == null) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="h-9"
        disabled
        title="Pick a client from the sidebar to add a booking"
      >
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        className="h-9"
        disabled={clientId == null}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {clientId != null ? (
        <NewBookingModal open={open} onOpenChange={setOpen} clientId={clientId} />
      ) : null}
    </>
  );
}

export { AddBookingButton };
export type { AddBookingButtonProps };
