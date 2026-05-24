// =============================================================================
// Cold-lead scanner (Phase 8 Session 1).
//
// Daily 09:00 UTC pg_cron schedule enqueues one `cold_lead_scan` job per
// enabled cold_lead_nudge automation (one row per client). This handler
// iterates leads matching the cold-lead criteria and fires a `lead_inactive`
// trigger for each.
//
// Cold-lead criteria (per the brief):
//   • Lead's client_id matches the automation's
//   • automation_state NOT IN ('completed', 'archived')
//   • leads.status NOT IN ('completed', 'archived', 'lost')   (* archived is
//     not a status enum value in V1; treated as a no-op)
//   • last_outbound_at IS NOT NULL
//   • last_inbound_at IS NULL OR last_inbound_at < last_outbound_at
//   • last_outbound_at < (now - trigger_config.days_after_last_outbound)
//   • followup_nudge_count < trigger_config.max_nudges
//   • (needs_followup_at IS NULL OR followup_dismissed_at IS NOT NULL)
//
// The last condition lets a dismissed lead re-fire (after the operator
// dismissed and the lead later went cold again, or 24h later if still
// quiet) — followup_dismissed_at is the watermark that lets the surface
// hide a lead AND lets the scanner re-pick it up the next day.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import { onTrigger } from './engine';
import type { AutomationRow } from './engine-types';

export type ColdLeadScanResult = {
  scanned: number;
  triggered: number;
  skipped: number;
};

export async function runColdLeadScan(
  clientId: string,
  automationId: string,
): Promise<ColdLeadScanResult> {
  const db = getIntegrationDb();

  // Load the automation row so we have the trigger_config thresholds.
  const { data: autoData, error: autoError } = await db
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .maybeSingle();
  if (autoError || !autoData) {
    return { scanned: 0, triggered: 0, skipped: 0 };
  }
  const automation = autoData as unknown as AutomationRow;
  if (!automation.is_enabled) {
    return { scanned: 0, triggered: 0, skipped: 0 };
  }
  const cfg = automation.trigger_config ?? {};
  const days = typeof cfg.days_after_last_outbound === 'number'
    ? cfg.days_after_last_outbound
    : 4;
  const maxNudges = typeof cfg.max_nudges === 'number' ? cfg.max_nudges : 3;
  const cutoffIso = new Date(Date.now() - days * 86_400_000).toISOString();

  // Pull candidate leads. The `last_outbound_at < cutoff` + nudge-count
  // filters happen in SQL; the inbound/outbound ordering check is too
  // awkward to express compactly in PostgREST so we filter in JS.
  // Volume is bounded — daily scan, per-client.
  const { data: candidates, error } = await db
    .from('leads')
    .select('id, status, automation_state, last_inbound_at, last_outbound_at, needs_followup_at, followup_dismissed_at, followup_nudge_count')
    .eq('client_id', clientId)
    .not('last_outbound_at', 'is', null)
    .lt('last_outbound_at', cutoffIso)
    .lt('followup_nudge_count', maxNudges)
    .not('automation_state', 'in', '("completed","archived")')
    .not('status', 'in', '("completed","lost")');
  if (error) {
    return { scanned: 0, triggered: 0, skipped: 0 };
  }

  const rows = (candidates ?? []) as Array<{
    id: string;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
    needs_followup_at: string | null;
    followup_dismissed_at: string | null;
  }>;

  let triggered = 0;
  let skipped = 0;

  for (const lead of rows) {
    // Inbound newer than outbound = the lead isn't cold.
    if (lead.last_inbound_at && lead.last_outbound_at) {
      if (Date.parse(lead.last_inbound_at) >= Date.parse(lead.last_outbound_at)) {
        skipped += 1;
        continue;
      }
    }
    // Already-surfaced + not dismissed = leave it alone.
    if (lead.needs_followup_at && !lead.followup_dismissed_at) {
      skipped += 1;
      continue;
    }

    // Fire the trigger — single automation (not "all lead_inactive" — the
    // scanner enqueues per automation, so targeting is precise).
    try {
      await onTrigger(
        clientId,
        'lead_inactive',
        { leadId: lead.id, automationId },
        { automationId },
      );
      triggered += 1;
    } catch (err) {
      skipped += 1;
      console.warn(
        '[cold-lead-scanner] onTrigger failed',
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { scanned: rows.length, triggered, skipped };
}
