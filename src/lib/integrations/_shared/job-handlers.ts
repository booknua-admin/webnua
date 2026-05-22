// =============================================================================
// OAuth foundation job handlers.
//
// Phase 7 Session 2. Side-effect module: registers the job handlers the OAuth
// foundation owns. Imported by job-handler-manifest.ts so the registrations
// land in the executor's module graph.
//
//   token_refresh_check — enqueued daily by the migration 0056 cron. Refreshes
//   long-lived (Meta) connections before they lapse. refresh_access (Google)
//   connections are intentionally skipped: their access token is short-lived
//   and re-minted on demand from the refresh token, which itself does not
//   expire — a scheduled refresh would be pointless churn.
//
// SERVER-ONLY.
// =============================================================================

import type { OAuthProviderId } from '@/lib/integrations/connections';

import { getIntegrationDb } from './db-types';
import { registerJobHandler } from './jobs';
import { getAccessToken } from './tokens';

// Refresh a long-lived token once it is within this of expiry — wider than
// the on-demand 7-day window so a connection is extended well before any API
// call would otherwise have to.
const REFRESH_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

registerJobHandler('token_refresh_check', async () => {
  const horizon = new Date(Date.now() + REFRESH_HORIZON_MS).toISOString();
  const { data, error } = await getIntegrationDb()
    .from('integration_connections')
    .select('client_id, provider')
    .eq('token_model', 'long_lived')
    .eq('status', 'active')
    .lt('access_token_expires_at', horizon);
  if (error) {
    throw new Error(`token_refresh_check: connection scan failed — ${error.message}`);
  }

  const due = (data ?? []) as { client_id: string; provider: OAuthProviderId }[];
  let refreshed = 0;
  const failures: string[] = [];

  for (const conn of due) {
    try {
      // forceRefresh extends the long-lived token in place; getAccessToken
      // rotates the Vault secret and bumps last_refreshed_at.
      await getAccessToken(conn.client_id, conn.provider, { forceRefresh: true });
      refreshed += 1;
    } catch (error) {
      // getAccessToken has already marked the connection refresh_failed and
      // alerted the operator — record the failure and carry on; one broken
      // connection must not abort the batch.
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${conn.provider}/${conn.client_id}: ${message}`);
    }
  }

  return { checked: due.length, refreshed, failed: failures.length, failures };
});

export {};
