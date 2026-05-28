// =============================================================================
// Meta Ads — meta_campaign_launches + meta_ad_creatives data access.
//
// Phase 7.5 Session 1. Service-role writes for the two new training-data
// tables introduced in migration 0115. Reads in browser hooks go through
// the RLS-scoped client; everything here is server-side.
//
// The launch orchestrator (`launch-orchestrator.ts`) is the only insert
// site for `meta_campaign_launches`. The orchestrator + Session 4's
// refresh handler are the two insert sites for `meta_ad_creatives` —
// refresh stamps `ended_at` on the prior active row and inserts a new
// active one in one logical operation (the partial unique index enforces
// at most one active row per campaign).
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  MetaAdCreativeInsert,
  MetaAdCreativeRow,
  MetaCampaignLaunchInsert,
  MetaCampaignLaunchRow,
} from './types';

const LAUNCHES_TABLE = 'meta_campaign_launches';
const CREATIVES_TABLE = 'meta_ad_creatives';

export async function insertCampaignLaunch(
  insert: MetaCampaignLaunchInsert,
): Promise<MetaCampaignLaunchRow> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(LAUNCHES_TABLE)
    .insert(insert as unknown as never)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(
      `insertCampaignLaunch failed: ${error?.message ?? 'no row returned'}`,
    );
  }
  return data as MetaCampaignLaunchRow;
}

export async function findCampaignLaunch(
  metaCampaignId: string,
): Promise<MetaCampaignLaunchRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(LAUNCHES_TABLE)
    .select('*')
    .eq('meta_campaign_id', metaCampaignId)
    .maybeSingle();
  if (error) throw new Error(`findCampaignLaunch failed: ${error.message}`);
  return (data as MetaCampaignLaunchRow | null) ?? null;
}

export async function insertAdCreative(
  insert: MetaAdCreativeInsert,
): Promise<MetaAdCreativeRow> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(CREATIVES_TABLE)
    .insert(insert as unknown as never)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(
      `insertAdCreative failed: ${error?.message ?? 'no row returned'}`,
    );
  }
  return data as MetaAdCreativeRow;
}

/** Find the currently-active creative on a campaign (ended_at IS NULL).
 *  Session 4's refresh handler reads this to know which row to stamp
 *  ended_at on before inserting the new active row. */
export async function findActiveCreative(
  metaCampaignId: string,
): Promise<MetaAdCreativeRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(CREATIVES_TABLE)
    .select('*')
    .eq('meta_campaign_id', metaCampaignId)
    .is('ended_at', null)
    .maybeSingle();
  if (error) throw new Error(`findActiveCreative failed: ${error.message}`);
  return (data as MetaAdCreativeRow | null) ?? null;
}

/** History of every creative version on a campaign (active + ended).
 *  Session 4 reads this for "previous creative" comparison + the
 *  per-creative outcome attribution view. */
export async function listCreativesForCampaign(
  metaCampaignId: string,
): Promise<MetaAdCreativeRow[]> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(CREATIVES_TABLE)
    .select('*')
    .eq('meta_campaign_id', metaCampaignId)
    .order('started_at', { ascending: false });
  if (error) throw new Error(`listCreativesForCampaign failed: ${error.message}`);
  return (data as MetaAdCreativeRow[] | null) ?? [];
}

/** Stamp ended_at on a creative row. Called by Session 4's refresh
 *  handler immediately before inserting the new active row, so the
 *  partial unique index (one ended_at IS NULL row per campaign)
 *  stays satisfied. */
export async function endCreative(
  id: string,
  endedAt: string = new Date().toISOString(),
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from(CREATIVES_TABLE)
    .update({ ended_at: endedAt } as unknown as never)
    .eq('id', id);
  if (error) throw new Error(`endCreative failed: ${error.message}`);
}
