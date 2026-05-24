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

import type { MetaCampaign } from './types';
import type {
  MetaCampaignDbStatus,
  MetaCampaignInsert,
  MetaCampaignRow,
} from './types';
import { mapMetaStatusToLocal } from './types';

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

/** Ingest a campaign discovered on Meta (via `listCampaignsForAdAccount`)
 *  into Webnua's `public.campaigns` + `meta_campaigns` tables. Idempotent
 *  on the Meta campaign id — re-running this for the same campaign
 *  updates the existing row instead of inserting a duplicate.
 *
 *  Returns the resulting `meta_campaigns` row and a flag indicating
 *  whether it was a fresh insert (the handler counts these for the
 *  job's observability output).
 *
 *  V1 fills `meta_ad_set_id` / `meta_ad_id` / `meta_creative_id` /
 *  `meta_lead_form_id` as null — discovering those requires walking
 *  the ad-set → ad → creative chain, which is a separate concern
 *  (see CLAUDE.md follow-up). Without `meta_lead_form_id`, the
 *  `meta_sync_leads` job has nothing to attach to for this campaign,
 *  but insights still flow through `meta_sync_insights`. */
export async function upsertCampaignFromMeta(args: {
  clientId: string;
  metaCampaign: MetaCampaign;
  createdVia: 'webnua_month_1' | 'webnua_ongoing' | 'external';
}): Promise<{ row: MetaCampaignRow; inserted: boolean }> {
  const { clientId, metaCampaign } = args;
  if (!metaCampaign.id) {
    throw new Error('upsertCampaignFromMeta: metaCampaign.id is required');
  }
  const status = mapMetaStatusToLocal(metaCampaign.effective_status);
  const dailyBudgetCents = parseMinorUnits(metaCampaign.daily_budget);
  const lifetimeBudgetCents = parseMinorUnits(metaCampaign.lifetime_budget);
  const startDate = isoDateOrNull(metaCampaign.start_time);
  const endDate = isoDateOrNull(metaCampaign.stop_time);
  const campaignName = metaCampaign.name ?? `Meta campaign ${metaCampaign.id}`;
  // The public.campaigns table uses 'active' / 'paused' / 'pending'; map
  // the broader meta status set into those.
  const publicStatus = publicStatusFromMeta(status);
  // Convert minor units (cents) to the major-unit decimal public.campaigns
  // stores. Prefer daily budget; fall back to a portion of lifetime when
  // present.
  const publicBudget =
    dailyBudgetCents != null
      ? dailyBudgetCents / 100
      : lifetimeBudgetCents != null
        ? lifetimeBudgetCents / 100
        : null;

  const db = getIntegrationDb();
  const existing = await findMetaCampaignByMetaId(metaCampaign.id);
  if (existing) {
    // Update the public.campaigns row first (the one the /campaigns
    // reader joins through), then the meta_campaigns row.
    await db
      .from('campaigns')
      .update({
        name: campaignName,
        status: publicStatus,
        budget: publicBudget,
        starts_at: startDate,
        ends_at: endDate,
      } as unknown as never)
      .eq('id', existing.campaign_id);
    const { data, error } = await db
      .from(TABLE)
      .update({
        campaign_name: campaignName,
        objective: metaCampaign.objective ?? existing.objective ?? 'OUTCOME_LEADS',
        status,
        daily_budget_cents: dailyBudgetCents ?? existing.daily_budget_cents ?? null,
        lifetime_budget_cents:
          lifetimeBudgetCents ?? existing.lifetime_budget_cents ?? null,
        start_date: startDate ?? existing.start_date ?? null,
        end_date: endDate ?? existing.end_date ?? null,
        last_synced_at: new Date().toISOString(),
      } as unknown as never)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error || !data) {
      throw new Error(
        `upsertCampaignFromMeta update failed: ${error?.message ?? 'no row'}`,
      );
    }
    return { row: data as MetaCampaignRow, inserted: false };
  }

  // Fresh insert: create the public.campaigns row first, then the
  // meta_campaigns row referencing it. external_ref carries the Meta
  // campaign id so existing surfaces that read public.campaigns directly
  // can still join through.
  const { data: campaignRow, error: campaignErr } = await db
    .from('campaigns')
    .insert({
      client_id: clientId,
      name: campaignName,
      status: publicStatus,
      budget: publicBudget,
      starts_at: startDate,
      ends_at: endDate,
      external_ref: metaCampaign.id,
    } as unknown as never)
    .select('id')
    .single();
  if (campaignErr || !campaignRow) {
    throw new Error(
      `upsertCampaignFromMeta campaigns insert failed: ${campaignErr?.message ?? 'no row'}`,
    );
  }
  const inserted = await insertMetaCampaign({
    client_id: clientId,
    campaign_id: (campaignRow as { id: string }).id,
    meta_campaign_id: metaCampaign.id,
    meta_ad_set_id: null,
    meta_ad_id: null,
    meta_creative_id: null,
    meta_lead_form_id: null,
    campaign_name: campaignName,
    objective: metaCampaign.objective ?? 'OUTCOME_LEADS',
    status,
    daily_budget_cents: dailyBudgetCents,
    lifetime_budget_cents: lifetimeBudgetCents,
    start_date: startDate,
    end_date: endDate,
    created_via: args.createdVia,
    template_slug: null,
    last_synced_at: new Date().toISOString(),
    last_insights_synced_at: null,
  });
  return { row: inserted, inserted: true };
}

async function findMetaCampaignByMetaId(
  metaCampaignId: string,
): Promise<MetaCampaignRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('meta_campaign_id', metaCampaignId)
    .maybeSingle();
  if (error) throw new Error(`findMetaCampaignByMetaId failed: ${error.message}`);
  return (data as MetaCampaignRow | null) ?? null;
}

function parseMinorUnits(value: string | undefined | null): number | null {
  if (value == null) return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function isoDateOrNull(value: string | undefined | null): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  // Meta returns full ISO-8601 with offset; we only persist the date.
  return value.slice(0, 10);
}

function publicStatusFromMeta(s: MetaCampaignDbStatus): string {
  // public.campaigns uses a narrower vocabulary than meta_campaigns; map
  // review / issue states to 'pending' so the operator sees them as
  // "awaiting launch" rather than running.
  switch (s) {
    case 'active':
      return 'active';
    case 'paused':
      return 'paused';
    case 'archived':
      return 'paused';
    case 'in_review':
    case 'with_issues':
    default:
      return 'pending';
  }
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
    meta_lead_form_id: string | null;
  }>,
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from(TABLE)
    .update(patch as unknown as never)
    .eq('id', id);
  if (error) throw new Error(`updateMetaCampaignSync failed: ${error.message}`);
}
