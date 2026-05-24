'use client';

// =============================================================================
// InviteTeammateButton — the "+ Invite teammate" trigger.
//
// Two callers:
//   - A client business owner inviting a teammate into their own account
//     (the original use). Resolves clientId from useUser().clientId.
//   - An operator in SUB-ACCOUNT mode inviting into the active client (the
//     operator-concierge path — sub-account /settings/team mounts this).
//     Resolves clientId from useWorkspace().activeClientId.
//
// Renders nothing when no client is in scope (operator in agency mode,
// signed-out user, etc.) so the same button works on either surface
// without per-page wiring.
//
// Optional `label` prop lets the caller frame the action — the concierge
// path passes "Invite the owner" when no client users exist yet, while
// the teammate-add path keeps the default "+ Invite teammate".
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';
import { ClientTeamInviteModal } from './ClientTeamInviteModal';

type Props = {
  /** Override the button label. Defaults to "+ Invite teammate". */
  label?: string;
};

function InviteTeammateButton({ label = '+ Invite teammate' }: Props) {
  const user = useUser();
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);

  // Resolve the target client: client-role user → their own; operator →
  // the active sub-account (null in agency mode).
  const clientId =
    user?.role === 'admin' ? workspace.activeClientId : user?.clientId ?? null;

  if (!clientId) return null;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ClientTeamInviteModal open={open} onOpenChange={setOpen} clientId={clientId} />
    </>
  );
}

export { InviteTeammateButton };
