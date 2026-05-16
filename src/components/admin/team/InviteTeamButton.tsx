'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { TeamInviteModal } from './TeamInviteModal';

function InviteTeamButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Invite member
      </Button>
      <TeamInviteModal open={open} onOpenChange={setOpen} />
    </>
  );
}

export { InviteTeamButton };
