'use client';

// 'use client' trigger for the integration connect flow — owns the modal open
// state so IntegrationCard itself stays server-renderable. Same pattern as
// AddBookingButton / NegativeReviewAlertButton.

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import {
  ConnectIntegrationModal,
  type ConnectIntegrationMode,
  type ConnectIntegrationTarget,
} from './ConnectIntegrationModal';

type ConnectIntegrationButtonProps = {
  mode: ConnectIntegrationMode;
  integration: ConnectIntegrationTarget;
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
};

function ConnectIntegrationButton({
  mode,
  integration,
  label,
  variant = 'outline',
}: ConnectIntegrationButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConnectIntegrationModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        integration={integration}
      />
    </>
  );
}

export { ConnectIntegrationButton };
export type { ConnectIntegrationButtonProps };
