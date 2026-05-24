// =============================================================================
// Meta Ads — job types + payload shapes.
//
// Two registered handlers (see job-handlers.ts):
//
// 1. meta_sync_insights — pulls yesterday's insights for one Meta campaign
//    via Meta's /insights endpoint and upserts into meta_ads_insights.
//    Enqueued by the daily pg_cron schedule (migration 0074).
//
// 2. meta_sync_leads — pulls leads created since the last sync for one
//    Meta lead form and inserts into public.leads (source_kind='meta').
//    Enqueued every 15 minutes by pg_cron (migration 0074).
//
// SERVER + CLIENT safe — pure types + constants only.
// =============================================================================

export const META_SYNC_INSIGHTS_JOB = 'meta_sync_insights';

export type MetaSyncInsightsPayload = {
  clientId: string;
  metaCampaignId: string;       // local meta_campaigns row id (UUID)
  /** Override the date range. Omit to default to yesterday-only (the daily
   *  cron path). Manual "Sync now" affordances can ask for a wider window
   *  to backfill. */
  dateRange?: { since: string; until: string };
};

export const META_SYNC_LEADS_JOB = 'meta_sync_leads';

export type MetaSyncLeadsPayload = {
  clientId: string;
  metaCampaignId: string;       // local meta_campaigns row id (UUID)
  metaLeadFormId: string;       // local meta_lead_forms row id (UUID)
  metaFormId: string;           // the Meta-side form id (string of digits)
  /** Override the lookback. Omit to default to ~1 hour (the every-15-min
   *  cron path is comfortable with 1h overlap because the ingest dedupes
   *  on meta_lead_id). */
  fromUnix?: number;
};

/** Type-narrow a raw payload (from integration_jobs.payload) into the
 *  insights payload shape. Returns null on missing required fields. */
export function normalizeSyncInsightsPayload(
  raw: unknown,
): MetaSyncInsightsPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const clientId = stringOrNull(r.clientId);
  const metaCampaignId = stringOrNull(r.metaCampaignId);
  if (!clientId || !metaCampaignId) return null;
  const dateRange = r.dateRange;
  const cleanRange =
    dateRange &&
    typeof dateRange === 'object' &&
    typeof (dateRange as Record<string, unknown>).since === 'string' &&
    typeof (dateRange as Record<string, unknown>).until === 'string'
      ? {
          since: (dateRange as Record<string, string>).since,
          until: (dateRange as Record<string, string>).until,
        }
      : undefined;
  return { clientId, metaCampaignId, dateRange: cleanRange };
}

export function normalizeSyncLeadsPayload(
  raw: unknown,
): MetaSyncLeadsPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const clientId = stringOrNull(r.clientId);
  const metaCampaignId = stringOrNull(r.metaCampaignId);
  const metaLeadFormId = stringOrNull(r.metaLeadFormId);
  const metaFormId = stringOrNull(r.metaFormId);
  if (!clientId || !metaCampaignId || !metaLeadFormId || !metaFormId) return null;
  const fromUnix = typeof r.fromUnix === 'number' ? r.fromUnix : undefined;
  return { clientId, metaCampaignId, metaLeadFormId, metaFormId, fromUnix };
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === 'null') return null;
  return trimmed;
}
