// =============================================================================
// Meta Ads — registered job handlers (insights sync + leads sync).
//
// Phase 7 Meta Ads. Both handlers are registered at module-load time via
// registerJobHandler — the side-effect import lives in job-handler-manifest.ts.
//
// SERVER-ONLY.
// =============================================================================

import { registerJobHandler, type JobContext } from '@/lib/integrations/_shared/jobs';

import {
  getCampaign,
  getCampaignInsights,
  getLeads,
} from './client';
import {
  findMetaCampaignById,
  updateMetaCampaignSync,
} from './campaigns';
import { upsertInsights } from './insights';
import { ingestMetaLeads, getIntegrationDbForLeadSync } from './lead-sync';
import {
  META_SYNC_INSIGHTS_JOB,
  META_SYNC_LEADS_JOB,
  normalizeSyncInsightsPayload,
  normalizeSyncLeadsPayload,
} from './job-types';
import { mapMetaStatusToLocal, type MetaInsightsRow } from './types';

// --- helpers -----------------------------------------------------------------

function defaultYesterdayRange(): { since: string; until: string } {
  const now = new Date();
  // Yesterday in UTC.
  const day = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
  ));
  const iso = day.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  return { since: iso, until: iso };
}

function asNumber(value: string | undefined): number {
  if (typeof value !== 'string') return 0;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function extractLeadCount(row: MetaInsightsRow): number {
  if (!Array.isArray(row.actions)) return 0;
  // Meta returns lead counts under one of several action types depending
  // on the campaign objective. Sum the candidates — they're mutually
  // exclusive within a single campaign.
  const candidates = new Set(['lead', 'leadgen_grouped', 'onsite_conversion.lead_grouped']);
  let total = 0;
  for (const a of row.actions) {
    if (typeof a.action_type === 'string' && candidates.has(a.action_type)) {
      total += Math.round(asNumber(a.value));
    }
  }
  return total;
}

function extractCplCents(row: MetaInsightsRow): number | null {
  if (!Array.isArray(row.cost_per_action_type)) return null;
  const candidates = new Set(['lead', 'leadgen_grouped', 'onsite_conversion.lead_grouped']);
  for (const c of row.cost_per_action_type) {
    if (typeof c.action_type === 'string' && candidates.has(c.action_type)) {
      // cost_per_action_type values come back as decimal strings ("€" or "$")
      // — convert to minor units (cents).
      const n = asNumber(c.value);
      if (n > 0) return Math.round(n * 100);
    }
  }
  return null;
}

// --- meta_sync_insights ------------------------------------------------------

async function handleSyncInsights(
  rawPayload: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: JobContext,
): Promise<{ insightsRows: number; localStatus: string }> {
  const payload = normalizeSyncInsightsPayload(rawPayload);
  if (!payload) {
    throw new Error('meta_sync_insights: invalid payload');
  }

  const local = await findMetaCampaignById(payload.metaCampaignId);
  if (!local) {
    // Local row deleted between cron emission and execution — silently
    // succeed; the next cron tick won't enqueue it.
    return { insightsRows: 0, localStatus: 'campaign-not-found' };
  }
  if (local.client_id !== payload.clientId) {
    throw new Error('meta_sync_insights: clientId/metaCampaignId mismatch');
  }

  const range = payload.dateRange ?? defaultYesterdayRange();

  // 1. Refresh the live campaign status (so a Meta-side pause/disapproval
  //    surfaces locally without waiting for next manual fetch).
  const liveCampaign = await getCampaign(local.client_id, local.meta_campaign_id);
  let nextStatus = local.status;
  if (liveCampaign.ok && liveCampaign.data.effective_status) {
    nextStatus = mapMetaStatusToLocal(liveCampaign.data.effective_status);
  }

  // 2. Fetch insights for the range.
  const insights = await getCampaignInsights(
    local.client_id,
    local.meta_campaign_id,
    range,
  );
  if (!insights.ok) {
    // Auth failure surfaces as a thrown — the connection's refresh_failed
    // state was already set by callWithToken. The job will retry; if a
    // human reconnects in the meantime, the next attempt succeeds.
    throw new Error(
      `meta_sync_insights: insights fetch failed (${insights.error.class}): ${insights.error.message}`,
    );
  }

  // 3. Upsert one row per day.
  const rows = (insights.data.data ?? []).map((r) => {
    const impressions = Math.round(asNumber(r.impressions));
    const clicks = Math.round(asNumber(r.clicks));
    const leads = extractLeadCount(r);
    // Meta returns spend as a decimal string in the account's currency
    // (e.g. "12.34"). Convert to minor units to align with our schema.
    const spendCents = Math.round(asNumber(r.spend) * 100);
    return {
      client_id: local.client_id,
      meta_campaign_id: local.id,
      date_recorded: r.date_start ?? range.since,
      impressions,
      clicks,
      leads,
      spend_cents: spendCents,
      cpl_cents: extractCplCents(r),
      ctr_bps: impressions > 0 ? Math.round((clicks / impressions) * 10000) : null,
      raw_payload: r,
    };
  });
  await upsertInsights(rows);

  // 4. Update local sync state.
  await updateMetaCampaignSync(local.id, {
    status: nextStatus,
    last_synced_at: new Date().toISOString(),
    last_insights_synced_at: new Date().toISOString(),
  });

  return {
    insightsRows: rows.length,
    localStatus: nextStatus,
  };
}

// --- meta_sync_leads ---------------------------------------------------------

async function handleSyncLeads(
  rawPayload: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _ctx: JobContext,
): Promise<{ inserted: number; skipped: number; errors: number }> {
  const payload = normalizeSyncLeadsPayload(rawPayload);
  if (!payload) {
    throw new Error('meta_sync_leads: invalid payload');
  }

  // Pull recent leads. The fromUnix override lets a manual sync widen
  // the window; default (no override) is the last 1 hour.
  const lookback =
    payload.fromUnix ?? Math.floor(Date.now() / 1000) - 60 * 60;
  const result = await getLeads(payload.clientId, payload.metaFormId, lookback);
  if (!result.ok) {
    throw new Error(
      `meta_sync_leads: getLeads failed (${result.error.class}): ${result.error.message}`,
    );
  }
  const leads = result.data.data ?? [];
  const db = getIntegrationDbForLeadSync();
  return ingestMetaLeads(db, payload.clientId, leads);
}

// --- registration ------------------------------------------------------------

registerJobHandler(META_SYNC_INSIGHTS_JOB, handleSyncInsights);
registerJobHandler(META_SYNC_LEADS_JOB, handleSyncLeads);
