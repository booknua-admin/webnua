'use client';

// 'use client' trigger for the generate-API-key flow — owns the modal open
// state so the /settings/api page itself stays server-renderable. Same pattern
// as ConnectIntegrationButton / AddBookingButton.

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { GenerateApiKeyModal } from './GenerateApiKeyModal';

function GenerateApiKeyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + Generate new key
      </Button>
      <GenerateApiKeyModal open={open} onOpenChange={setOpen} />
    </>
  );
}

export { GenerateApiKeyButton };
