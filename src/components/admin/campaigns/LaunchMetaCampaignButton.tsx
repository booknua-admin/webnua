'use client';

// =============================================================================
// LaunchMetaCampaignButton — operator-only campaign actions strip.
//
// Phase 7.5 Session 1 rewrite. Was previously a deep-link to Ads Manager
// only (V1 model: build campaigns in Meta's UI). Now hosts THREE actions:
//
//   • + New campaign (primary)   — opens LaunchCampaignWizard (the
//                                  in-app Meta lead-form campaign builder)
//   • ↻ Sync campaigns           — fires the existing meta_sync_campaigns
//                                  ingest job for the active client
//   • Open Meta Ads Manager ↗   — keeps the deep-link as the secondary
//                                  "advanced" path for campaigns the
//                                  operator wants to manage outside
//                                  Webnua's templated flow
//
// Disabled states:
//   • Agency mode (no client picked)   → "Pick a client" tooltip
//   • Sub-account + no ad account      → "Wire Meta first" tooltip
// =============================================================================

import { useState } from 'react';

import { LaunchCampaignWizard } from '@/components/admin/campaigns/LaunchCampaignWizard';
import { Button } from '@/components/ui/button';
import { useClientId } from '@/lib/clients/queries';
import {
  useClientMetaAdAccount,
  useSyncMetaAccountCampaigns,
} from '@/lib/integrations/meta-ads/use-meta-ads';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

function adsManagerUrl(
  adAccountId: string,
  businessId: string | null | undefined,
): string {
  const numeric = adAccountId.startsWith('act_') ? adAccountId.slice(4) : adAccountId;
  const params = new URLSearchParams({ act: numeric });
  if (businessId) params.set('business_id', businessId);
  return `https://business.facebook.com/adsmanager/manage/campaigns?${params.toString()}`;
}

export function LaunchMetaCampaignButton() {
  const { activeClientId } = useWorkspace();
  const { data: clientId } = useClientId(activeClientId);
  const adAccount = useClientMetaAdAccount(clientId ?? null);
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!activeClientId) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="h-9"
        disabled
        title="Pick a client from the sidebar to manage their Meta campaigns"
      >
        + New campaign
      </Button>
    );
  }

  const row = adAccount.data ?? null;
  if (!row || !clientId) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="h-9"
        disabled
        title="Wire Meta + pick an ad account on /settings/integrations first"
      >
        + New campaign
      </Button>
    );
  }

  const href = adsManagerUrl(row.meta_ad_account_id, row.meta_business_id);
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        className="h-9"
        onClick={() => setWizardOpen(true)}
      >
        + New campaign
      </Button>
      <SyncCampaignsButton clientId={clientId} />
      <Button asChild type="button" variant="outline" className="h-9">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title="Manage existing campaigns directly in Meta Ads Manager"
        >
          Ads Manager ↗
        </a>
      </Button>

      <LaunchCampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        clientId={clientId}
      />
    </div>
  );
}

function SyncCampaignsButton({ clientId }: { clientId: string }) {
  const sync = useSyncMetaAccountCampaigns();
  const [justQueued, setJustQueued] = useState(false);
  async function handleClick() {
    setJustQueued(false);
    try {
      await sync.mutateAsync({ clientId });
      setJustQueued(true);
      window.setTimeout(() => setJustQueued(false), 3000);
    } catch {
      // sync.error is exposed
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      className="h-9"
      disabled={sync.isPending}
      onClick={handleClick}
      title="Pull the latest campaigns from Meta into /campaigns"
    >
      {sync.isPending ? 'Syncing…' : justQueued ? 'Queued ✓' : '↻ Sync'}
    </Button>
  );
}
