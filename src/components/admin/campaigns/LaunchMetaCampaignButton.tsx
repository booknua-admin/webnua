'use client';

// =============================================================================
// LaunchMetaCampaignButton — operator trigger that hands off to Meta Ads
// Manager for the connected ad account.
//
// Phase 7 Meta Ads · V1 model: Webnua doesn't build campaigns in-app. The
// customer's OAuth grant gives Webnua business-manager access to their ad
// account, and the operator manages campaigns directly in Meta's own UI.
// This button is the entry point — it opens Ads Manager scoped to the
// customer's ad account in a new tab.
//
// States:
//   • Agency mode (no client picked)   → disabled, "Pick a client".
//   • Sub-account + no ad account      → disabled, "Wire Meta first".
//   • Sub-account + ad account wired   → opens Ads Manager + a sibling
//     "Sync campaigns" button refreshes the in-app roster from Meta.
//
// Campaigns built in Meta Ads Manager flow into Webnua via the
// `meta_sync_campaigns` ingest job (auto-fires after a fresh ad-account
// pick, hourly by cron thereafter). The "Sync campaigns" button here
// re-runs that job immediately for the active client.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useClientId } from '@/lib/clients/queries';
import {
  useClientMetaAdAccount,
  useSyncMetaAccountCampaigns,
} from '@/lib/integrations/meta-ads/use-meta-ads';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

/** Build the Ads Manager deep-link for an ad account. `meta_ad_account_id`
 *  is stored with the `act_` prefix (Meta's canonical form on the API);
 *  the `?act=` URL param wants the bare numeric id. business.facebook.com
 *  scopes the session to the customer's Business Manager when a
 *  `meta_business_id` is available — falls back to a non-scoped URL
 *  otherwise. */
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

  if (!activeClientId) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="h-9"
        disabled
        title="Pick a client from the sidebar to manage their Meta campaigns"
      >
        Open Meta Ads Manager →
      </Button>
    );
  }

  const row = adAccount.data ?? null;
  if (!row) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="h-9"
        disabled
        title="Wire Meta + pick an ad account on /settings/integrations first"
      >
        Open Meta Ads Manager →
      </Button>
    );
  }

  const href = adsManagerUrl(row.meta_ad_account_id, row.meta_business_id);
  return (
    <div className="flex items-center gap-2">
      <SyncCampaignsButton clientId={clientId!} />
      <Button asChild type="button" className="h-9">
        <a href={href} target="_blank" rel="noopener noreferrer">
          Open Meta Ads Manager →
        </a>
      </Button>
    </div>
  );
}

/** "Sync campaigns" button — fires `meta_sync_campaigns` for the active
 *  client. Settles into a "Queued" confirmation for a few seconds so the
 *  operator sees something happened (the actual roster refresh happens
 *  on the next render via the invalidation in `useSyncMetaAccountCampaigns`). */
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
      // The mutation already exposes `sync.error` for the failure
      // message; the button just shows the catch-all state.
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
      {sync.isPending ? 'Syncing…' : justQueued ? 'Queued ✓' : '↻ Sync campaigns'}
    </Button>
  );
}
