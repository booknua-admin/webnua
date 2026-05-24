// =============================================================================
// Action handler — create_followup_task (Phase 8 Session 1).
//
// The cold-lead nudge action. Sets leads.needs_followup_at = now() and
// increments leads.followup_nudge_count. Never sends a message — the client
// writes the follow-up themselves (cold lead surface principle).
//
// The dismiss-followup endpoint is what clears this — see
// handoff.dismissFollowupTask.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { ActionContext, ActionOutcome } from './dispatch';

export async function runCreateFollowupTask(ctx: ActionContext): Promise<ActionOutcome> {
  if (!ctx.run.lead_id) return { kind: 'skipped', reason: 'no_lead_id' };
  const db = getIntegrationDb();

  // Read current count so we can increment via a single round trip.
  const { data, error } = await db
    .from('leads')
    .select('followup_nudge_count')
    .eq('id', ctx.run.lead_id)
    .maybeSingle();
  if (error || !data) {
    return { kind: 'skipped', reason: 'lead_not_found' };
  }
  const row = data as unknown as { followup_nudge_count: number | null };
  const nextCount = (row.followup_nudge_count ?? 0) + 1;

  await db
    .from('leads')
    .update({
      needs_followup_at: new Date().toISOString(),
      followup_dismissed_at: null,
      followup_nudge_count: nextCount,
    })
    .eq('id', ctx.run.lead_id);
  return { kind: 'ok' };
}
