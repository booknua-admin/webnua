// =============================================================================
// Meta Ads — meta_ads_insights data access.
//
// Phase 7 Meta Ads. Per-day upserts keyed on (meta_campaign_id, date_recorded);
// re-fetching a date OVERWRITES rather than duplicates.
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { MetaAdsInsightsInsert, MetaAdsInsightsRow } from './types';

const TABLE = 'meta_ads_insights';

export async function upsertInsights(
  rows: MetaAdsInsightsInsert[],
): Promise<void> {
  if (rows.length === 0) return;
  const db = getIntegrationDb();
  const { error } = await db
    .from(TABLE)
    .upsert(rows as unknown as never, {
      onConflict: 'meta_campaign_id,date_recorded',
    });
  if (error) throw new Error(`upsertInsights failed: ${error.message}`);
}

export async function fetchInsightsForCampaign(
  metaCampaignId: string,
  sinceDate?: string,
): Promise<MetaAdsInsightsRow[]> {
  const db = getIntegrationDb();
  let q = db
    .from(TABLE)
    .select('*')
    .eq('meta_campaign_id', metaCampaignId)
    .order('date_recorded', { ascending: false });
  if (sinceDate) q = q.gte('date_recorded', sinceDate);
  const { data, error } = await q;
  if (error) throw new Error(`fetchInsightsForCampaign failed: ${error.message}`);
  return (data as MetaAdsInsightsRow[] | null) ?? [];
}

export async function fetchInsightsForClient(
  clientId: string,
  sinceDate: string,
): Promise<MetaAdsInsightsRow[]> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('client_id', clientId)
    .gte('date_recorded', sinceDate)
    .order('date_recorded', { ascending: false });
  if (error) throw new Error(`fetchInsightsForClient failed: ${error.message}`);
  return (data as MetaAdsInsightsRow[] | null) ?? [];
}
