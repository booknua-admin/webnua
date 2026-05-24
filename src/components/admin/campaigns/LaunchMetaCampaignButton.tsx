'use client';

// =============================================================================
// LaunchMetaCampaignButton — operator-only trigger for the launch wizard.
//
// Phase 7 Meta Ads. Mounted on the admin /campaigns content. Same pattern
// as AddBookingButton: a client must be picked (sub-account mode) before
// a launch can happen, because the campaign is created on THAT client's
// ad account. Agency mode → disabled with a tooltip prompting the
// operator to pick a client.
// =============================================================================

import { useState } from 'react';

import { LaunchMetaCampaignModal } from '@/components/admin/campaigns/LaunchMetaCampaignModal';
import { Button } from '@/components/ui/button';
import { useClientId } from '@/lib/clients/queries';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export function LaunchMetaCampaignButton() {
  const [open, setOpen] = useState(false);
  const { activeClientId } = useWorkspace();
  const { data: clientId } = useClientId(activeClientId);

  if (!activeClientId) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="h-9"
        disabled
        title="Pick a client from the sidebar to launch a Meta campaign"
      >
        + Launch Meta campaign
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        className="h-9"
        disabled={!clientId}
        onClick={() => setOpen(true)}
      >
        + Launch Meta campaign
      </Button>
      {clientId ? (
        <LaunchMetaCampaignModal
          open={open}
          onOpenChange={setOpen}
          clientId={clientId}
        />
      ) : null}
    </>
  );
}
