'use client';

// 'use client' trigger for "Sign out of all other sessions" — owns the
// ConfirmDialog open state so the /settings/security page stays server-
// renderable. STUB: no backend — confirming just dismisses the dialog.

import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';

function SignOutOtherSessionsButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-warn text-warn hover:bg-warn hover:text-paper"
        onClick={() => setConfirmOpen(true)}
      >
        Sign out of all other sessions
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sign out of all other sessions?"
        description="Every session except this device will be signed out immediately. You'll stay signed in here."
        confirmLabel="Sign out others"
        cancelLabel="Cancel"
        tone="destructive"
        onConfirm={() => {}}
      />
    </>
  );
}

export { SignOutOtherSessionsButton };
