'use client';

// =============================================================================
// InviteTeammateButton — the "+ Invite teammate" trigger on the client Team
// tab. Owns the modal open state. Sibling of admin/team/InviteTeamButton.
//
// Resolves the inviter's own client business from the signed-in user — a
// client owner can only invite into their own account, so there is no client
// picker. Renders nothing for a user with no client (e.g. an operator).
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { ClientTeamInviteModal } from './ClientTeamInviteModal';

function InviteTeammateButton() {
  const user = useUser();
  const [open, setOpen] = useState(false);

  if (!user?.clientId) return null;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Invite teammate
      </Button>
      <ClientTeamInviteModal
        open={open}
        onOpenChange={setOpen}
        clientId={user.clientId}
      />
    </>
  );
}

export { InviteTeammateButton };
