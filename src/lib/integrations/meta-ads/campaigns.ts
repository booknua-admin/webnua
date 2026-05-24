// =============================================================================
// Meta Ads — meta_campaigns data access.
//
// Phase 7 Meta Ads. The Meta-side companion to public.campaigns; the launch
// orchestrator inserts both. Reads are RLS-bound at the table level for the
// operator-UI hooks; writes here are service-role.
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  MetaCampaignDbStatus,
  MetaCampaignInsert,
  MetaCampaignRow,
} from './types';

const TABLE = 'meta_campaigns';

export async function findMetaCampaignById(
  id: string,
): Promise<MetaCampaignRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`findMetaCampaignById failed: ${error.message}`);
  return (data as MetaCampaignRow | null) ?? null;
}

export async function findMetaCampaignByCampaignId(
  campaignId: string,
): Promise<MetaCampaignRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (error) throw new Error(`findMetaCampaignByCampaignId failed: ${error.message}`);
  return (data as MetaCampaignRow | null) ?? null;
}

export async function listMetaCampaignsForClient(
  clientId: string,
): Promise<MetaCampaignRow[]> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listMetaCampaignsForClient failed: ${error.message}`);
  return (data as MetaCampaignRow[] | null) ?? [];
}

export async function insertMetaCampaign(
  insert: MetaCampaignInsert,
): Promise<MetaCampaignRow> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .insert(insert as unknown as never)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`insertMetaCampaign failed: ${error?.message ?? 'no row returned'}`);
  }
  return data as MetaCampaignRow;
}

export async function updateMetaCampaignStatus(
  id: string,
  status: MetaCampaignDbStatus,
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from(TABLE)
    .update({ status, last_synced_at: new Date().toISOString() } as unknown as never)
    .eq('id', id);
  if (error) throw new Error(`updateMetaCampaignStatus failed: ${error.message}`);
}

export async function updateMetaCampaignSync(
  id: string,
  patch: Partial<{
    status: MetaCampaignDbStatus;
    daily_budget_cents: number;
    lifetime_budget_cents: number;
    start_date: string;
    end_date: string;
    last_synced_at: string;
    last_insights_synced_at: string;
  }>,
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from(TABLE)
    .update(patch as unknown as never)
    .eq('id', id);
  if (error) throw new Error(`updateMetaCampaignSync failed: ${error.message}`);
}
