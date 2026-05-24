// =============================================================================
// Automation handoff (Phase 8 Session 1).
//
// The inbox is a handoff surface. Five operations:
//
//   • takeoverLead(leadId, userId)        — flips automation_state →
//                                            'taken_over', pauses any
//                                            running automation_runs on the
//                                            lead with paused_reason =
//                                            'client_took_over'.
//   • resumeAutomations(leadId)            — flips state back to 'automated'.
//                                            Does NOT resurrect paused runs;
//                                            the next trigger creates a
//                                            fresh run (operator decision).
//   • markLeadCompleted(leadId)            — flips state to 'completed' and
//                                            cancels all future runs on the
//                                            lead.
//   • dismissFollowupTask(leadId, userId)  — sets followup_dismissed_at; the
//                                            lead drops off the cold-lead
//                                            surface.
//   • recordInboundOnLead(leadId)          — called by inbound webhooks.
//                                            Updates last_inbound_at and
//                                            pauses any running comm-action
//                                            run on the lead.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

const COMM_ACTION_TYPES = new Set(['send_sms_to_lead', 'send_email_to_lead']);

export type HandoffResult = { ok: true; pausedRunCount: number };

/** Flip the lead to 'taken_over' and pause every running automation_run on
 *  it that hasn't already been paused. The pre-flight on the next action
 *  would catch a missed pause anyway, but updating the run rows here keeps
 *  the audit trail readable. */
export async function takeoverLead(leadId: string, userId: string): Promise<HandoffResult> {
  const db = getIntegrationDb();

  // 1) Flip the lead.
  await db
    .from('leads')
    .update({
      automation_state: 'taken_over',
      taken_over_at: new Date().toISOString(),
      taken_over_by: userId,
    })
    .eq('id', leadId);

  // 2) Pause running runs on this lead.
  const { data: runs, error: runsError } = await db
    .from('automation_runs')
    .select('id')
    .eq('lead_id', leadId)
    .eq('status', 'running');
  if (runsError || !runs) return { ok: true, pausedRunCount: 0 };

  const ids = (runs as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return { ok: true, pausedRunCount: 0 };

  await db
    .from('automation_runs')
    .update({
      status: 'paused',
      paused_reason: 'client_took_over',
      paused_at: new Date().toISOString(),
    })
    .in('id', ids);

  return { ok: true, pausedRunCount: ids.length };
}

/** Resume automations on a lead — flip state back to 'automated'. Paused
 *  runs are NOT auto-resurrected — the brief calls for an operator decision
 *  per run (Session 2 surface). Next-trigger creates a fresh run. */
export async function resumeAutomations(leadId: string): Promise<HandoffResult> {
  const db = getIntegrationDb();
  await db
    .from('leads')
    .update({ automation_state: 'automated', taken_over_at: null, taken_over_by: null })
    .eq('id', leadId);
  return { ok: true, pausedRunCount: 0 };
}

/** Mark the lead completed — all future automations on the lead are
 *  cancelled. Used by the lead-detail "Mark complete" UX (and future
 *  workflows like booking-completed). */
export async function markLeadCompleted(leadId: string): Promise<HandoffResult> {
  const db = getIntegrationDb();
  await db.from('leads').update({ automation_state: 'completed' }).eq('id', leadId);

  const { data: runs } = await db
    .from('automation_runs')
    .select('id')
    .eq('lead_id', leadId)
    .in('status', ['running', 'paused']);
  const ids = (runs as { id: string }[] | null)?.map((r) => r.id) ?? [];
  if (ids.length > 0) {
    await db
      .from('automation_runs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .in('id', ids);
  }
  return { ok: true, pausedRunCount: ids.length };
}

/** Dismiss the cold-lead nudge — clears needs_followup_at via the
 *  dismissed-at watermark. The lead drops off the GET /api/leads/needs-followup
 *  surface but the count + history stay (followup_nudge_count is preserved). */
export async function dismissFollowupTask(
  leadId: string,
  userId: string,
): Promise<{ ok: true }> {
  const db = getIntegrationDb();
  await db
    .from('leads')
    .update({ followup_dismissed_at: new Date().toISOString() })
    .eq('id', leadId);
  // userId is captured for future audit; intentionally unused beyond receipt.
  void userId;
  return { ok: true };
}

/** Update leads.last_outbound_at. Called by every outbound code path
 *  (manual reply route, the send_sms / send_email job handlers — though for
 *  V1 the comm-action handlers call this immediately rather than waiting on
 *  delivery webhooks). */
export async function recordOutboundOnLead(leadId: string | null | undefined): Promise<void> {
  if (!leadId) return;
  const db = getIntegrationDb();
  await db
    .from('leads')
    .update({ last_outbound_at: new Date().toISOString() })
    .eq('id', leadId);
}

/** Called by inbound webhooks (Resend inbound, Twilio inbound — when V2
 *  supports two-way) and lead_events inserts of kind 'sms_in' / 'email_in'.
 *  Updates last_inbound_at and pauses any running comm-action automation_run
 *  on this lead with paused_reason='lead_replied'. */
export async function recordInboundOnLead(leadId: string): Promise<void> {
  const db = getIntegrationDb();
  await db
    .from('leads')
    .update({ last_inbound_at: new Date().toISOString() })
    .eq('id', leadId);

  // Pause running runs whose CURRENT action is a comm-action. A non-comm
  // current action (a wait, an internal update) is allowed to proceed — the
  // engine's pre-flight will pause it later if the run is about to send.
  const { data: runs } = await db
    .from('automation_runs')
    .select('id, automation_id, current_action_position, action_sequence')
    .eq('lead_id', leadId)
    .eq('status', 'running');
  const list = (runs as
    | {
        id: string;
        automation_id: string;
        current_action_position: number;
        action_sequence: string[] | null;
      }[]
    | null) ?? [];
  if (list.length === 0) return;

  // Resolve which of those runs have a comm-action next. One round-trip per
  // run — list is short (most leads carry 1-2 active runs). Prefer the run's
  // snapshotted action_sequence (migration 0080) so a mid-run reorder of the
  // underlying actions doesn't misread the wrong action_type; fall back to
  // a live (automation_id, position) lookup for legacy / pre-0080 runs whose
  // sequence is empty.
  for (const run of list) {
    const sequence = run.action_sequence ?? [];
    const idAtPosition = sequence[run.current_action_position - 1];
    const actionQuery =
      idAtPosition
        ? db.from('automation_actions').select('action_type').eq('id', idAtPosition).maybeSingle()
        : db
            .from('automation_actions')
            .select('action_type')
            .eq('automation_id', run.automation_id)
            .eq('position', run.current_action_position)
            .maybeSingle();
    const { data: actionData } = await actionQuery;
    const actionType = (actionData as { action_type: string } | null)?.action_type;
    if (actionType && COMM_ACTION_TYPES.has(actionType)) {
      await db
        .from('automation_runs')
        .update({
          status: 'paused',
          paused_reason: 'lead_replied',
          paused_at: new Date().toISOString(),
        })
        .eq('id', run.id);
    }
  }
}
