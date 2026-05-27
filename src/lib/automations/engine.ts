// =============================================================================
// Automation engine — orchestration (Phase 8 Session 1).
//
// Two entry points:
//   • onTrigger(triggerType, payload) — find matching enabled automations,
//     evaluate trigger_filters against the live data, create runs, schedule
//     the first action.
//   • processNextAction(runId)        — the per-action executor. Loads the
//     run + the current action, runs the handoff pre-flight for actions
//     that pause on human activity, executes the action, advances position,
//     schedules the next.
//
// SERVER-ONLY. Reads + writes via the service-role client.
//
// The engine deliberately stays orchestration-only — the actual integration
// calls (Twilio send, Resend send, operator notification job) are unchanged;
// the engine just chains them through.
// =============================================================================

import {
  enqueueJob,
  enqueueJobImmediate,
} from '@/lib/integrations/_shared/jobs';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import {
  AUTOMATION_ACTION_JOB,
  type AutomationActionJobPayload,
} from './job-types';
import {
  ACTION_PAUSES_ON_HUMAN_ACTIVITY,
  type AutomationActionRow,
  type AutomationRow,
  type AutomationRunRow,
  type AutomationTriggerType,
  type LeadSnapshot,
} from './engine-types';
import { dispatchAction } from './actions/dispatch';
import {
  cancelLowerPriorityRuns,
  checkSuppressionForCommAction,
  type CommChannel,
} from './suppression';

const PAUSE_AFTER_MANUAL_HOURS_DEFAULT = 4;

function pauseAfterManualMs(): number {
  const raw = process.env.AUTOMATION_PAUSE_AFTER_MANUAL_HOURS;
  const hours = raw ? Number(raw) : PAUSE_AFTER_MANUAL_HOURS_DEFAULT;
  if (!Number.isFinite(hours) || hours < 0) {
    return PAUSE_AFTER_MANUAL_HOURS_DEFAULT * 3_600_000;
  }
  return hours * 3_600_000;
}

// --- onTrigger -------------------------------------------------------------

export type OnTriggerOptions = {
  /** Override the automation lookup: only fire this specific automation.
   *  Used by cold-lead-scanner so it can target the automation row that
   *  caused the scan, not every lead_inactive automation. */
  automationId?: string;
};

export type OnTriggerResult = {
  matched: number;
  enqueued: number;
  skipped: Array<{ automationId: string; reason: string }>;
};

/**
 * Entry point for every triggering event. Finds matching enabled automations
 * for the client, evaluates trigger_filters against the resolved lead /
 * customer / client data, creates one automation_run per match, and
 * enqueues the first action.
 *
 * Returns counts for observability — callers (and tests) can confirm a
 * trigger landed.
 */
export async function onTrigger(
  clientId: string,
  triggerType: AutomationTriggerType,
  triggerEvent: Record<string, unknown>,
  options: OnTriggerOptions = {},
): Promise<OnTriggerResult> {
  const db = getIntegrationDb();
  const skipped: Array<{ automationId: string; reason: string }> = [];

  // 1) Fetch matching enabled automations.
  let query = db
    .from('automations')
    .select('*')
    .eq('client_id', clientId)
    .eq('trigger_type', triggerType)
    .eq('is_enabled', true);
  if (options.automationId) {
    query = query.eq('id', options.automationId);
  }
  const { data: autoRows, error } = await query;
  if (error) {
    throw new Error(`onTrigger: automations lookup failed — ${error.message}`);
  }
  const automations = (autoRows ?? []) as unknown as AutomationRow[];
  if (automations.length === 0) {
    return { matched: 0, enqueued: 0, skipped };
  }

  // 2) Resolve the lead snapshot once if the trigger has one.
  const leadIdFromEvent = readString(triggerEvent, 'leadId');
  const lead = leadIdFromEvent ? await fetchLeadSnapshot(leadIdFromEvent) : null;

  // 3) Resolve a few once-per-trigger flags every filter might consult.
  const recipientPhone =
    readString(triggerEvent, 'recipientPhone') ?? lead?.customerPhone ?? '';
  const recipientEmail =
    readString(triggerEvent, 'recipientEmail') ?? lead?.customerEmail ?? '';
  const hasGbpLocation = await clientHasGbpLocation(clientId);

  let enqueued = 0;

  for (const automation of automations) {
    // 3a) Skip if the lead is in a terminal automation state.
    if (lead && (lead.automationState === 'archived' || lead.automationState === 'completed')) {
      skipped.push({ automationId: automation.id, reason: `lead_state:${lead.automationState}` });
      continue;
    }

    // 3b) Apply trigger_filters.
    const filterResult = checkFilters(automation.trigger_filters ?? {}, {
      hasPhone: Boolean(recipientPhone),
      hasEmail: Boolean(recipientEmail),
      hasGbpLocation,
      triggerEvent,
    });
    if (!filterResult.ok) {
      skipped.push({ automationId: automation.id, reason: filterResult.reason });
      continue;
    }

    // 3c) Snapshot the current action sequence. The run walks THIS array,
    //     so a later reorder / insert / remove only affects future runs.
    //     A zero-action automation produces an empty array → the run
    //     completes immediately on the next executor tick.
    const { data: actionIdRows, error: actionIdErr } = await db
      .from('automation_actions')
      .select('id')
      .eq('automation_id', automation.id)
      .order('position', { ascending: true });
    if (actionIdErr) {
      skipped.push({
        automationId: automation.id,
        reason: `action_sequence_lookup_failed:${actionIdErr.message}`,
      });
      continue;
    }
    const actionSequence = (actionIdRows ?? []).map((r) => (r as { id: string }).id);

    // 4) Insert the run.
    const { data: runData, error: runError } = await db
      .from('automation_runs')
      .insert({
        automation_id: automation.id,
        client_id: clientId,
        lead_id: lead?.id ?? null,
        trigger_event: triggerEvent,
        status: 'running',
        current_action_position: 1,
        action_sequence: actionSequence,
      } as unknown as never)
      .select('*')
      .single();
    if (runError || !runData) {
      skipped.push({
        automationId: automation.id,
        reason: `run_insert_failed:${runError?.message ?? 'unknown'}`,
      });
      continue;
    }
    const run = runData as unknown as AutomationRunRow;

    // 4b) Priority cancellation. When the new run is higher priority than
    //     existing running/paused runs on the same lead, cancel the lower-
    //     priority runs so the customer never gets a reputation request
    //     while a transactional follow-up is still in flight. Same-priority
    //     runs are left alone — they fall through to the frequency-cap layer.
    try {
      await cancelLowerPriorityRuns(run, automation);
    } catch (priorityError) {
      // Cancellation failure must not block the new run from scheduling —
      // log + continue. The duplicate flows would only hit the frequency
      // cap at send time anyway.
      console.warn(
        `[engine] cancelLowerPriorityRuns failed for run ${run.id}:`,
        priorityError instanceof Error ? priorityError.message : priorityError,
      );
    }

    // 5) Schedule the first action. Per-automation `delay_minutes` on
    //    trigger_config drives the first-action defer (e.g. 2h review-request).
    const delayMinutes = readNumber(automation.trigger_config ?? {}, 'delay_minutes') ?? 0;
    const runAfter = delayMinutes > 0 ? new Date(Date.now() + delayMinutes * 60_000) : undefined;
    try {
      const payload: AutomationActionJobPayload = { runId: run.id };
      if (runAfter) {
        await enqueueJob(AUTOMATION_ACTION_JOB, payload, {
          provider: 'automations',
          clientId,
          runAfter,
          correlationId: run.id,
        });
      } else {
        await enqueueJobImmediate(AUTOMATION_ACTION_JOB, payload, {
          provider: 'automations',
          clientId,
          correlationId: run.id,
        });
      }
      enqueued += 1;
    } catch (enqueueError) {
      const msg = enqueueError instanceof Error ? enqueueError.message : String(enqueueError);
      await db
        .from('automation_runs')
        .update({ status: 'failed', error_message: `enqueue_failed: ${msg}` })
        .eq('id', run.id);
      skipped.push({ automationId: automation.id, reason: `enqueue_failed:${msg}` });
    }
  }

  return { matched: automations.length, enqueued, skipped };
}

// --- processNextAction -----------------------------------------------------

export type ProcessActionResult =
  | { kind: 'completed'; runId: string }
  | { kind: 'paused'; runId: string; reason: string }
  | { kind: 'failed'; runId: string; error: string }
  | { kind: 'no_action_left'; runId: string }
  | { kind: 'run_not_running'; runId: string };

/**
 * Run one action of one run. Either completes the action and schedules the
 * next, or marks the run paused / completed / failed. The handoff pre-flight
 * runs before every action whose `pauses_on_human_activity = true`.
 */
export async function processNextAction(runId: string): Promise<ProcessActionResult> {
  const db = getIntegrationDb();

  // 1) Load the run.
  const { data: runData, error: runError } = await db
    .from('automation_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle();
  if (runError || !runData) {
    return { kind: 'failed', runId, error: `run_lookup_failed:${runError?.message ?? 'not_found'}` };
  }
  const run = runData as unknown as AutomationRunRow;
  if (run.status !== 'running') {
    return { kind: 'run_not_running', runId };
  }

  // 2) Resolve the next action via the run's snapshotted sequence
  //    (`action_sequence` from migration 0080). Walks forward from
  //    `current_action_position`, skipping any action id whose row has been
  //    deleted since the run was created. Falls back to the live live-query
  //    for legacy / pre-0080 runs whose `action_sequence` is empty.
  const resolved = await resolveActionForRun(run, run.current_action_position);
  if (resolved === 'lookup_failed') {
    await failRun(runId, 'action_lookup_failed');
    return { kind: 'failed', runId, error: 'action_lookup_failed' };
  }
  if (!resolved) {
    // Past the last action — run is complete.
    await db
      .from('automation_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', runId);
    return { kind: 'no_action_left', runId };
  }
  const { action, position: actionPosition } = resolved;

  // If the resolver skipped past gone-missing actions, advance the stored
  // position to the slot we're actually about to execute. Keeps the surface
  // (`/api/leads/[id]/automation-state`) honest about where the run is.
  if (actionPosition !== run.current_action_position) {
    await db
      .from('automation_runs')
      .update({ current_action_position: actionPosition })
      .eq('id', runId);
    run.current_action_position = actionPosition;
  }

  // 3) Pre-flight handoff check for actions that pause on human activity.
  if (action.pauses_on_human_activity) {
    const pause = await shouldPauseForHumanActivity(run.lead_id, run.last_automation_message_at);
    if (pause) {
      await db
        .from('automation_runs')
        .update({
          status: 'paused',
          paused_reason: pause.reason,
          paused_at: new Date().toISOString(),
        })
        .eq('id', runId);
      return { kind: 'paused', runId, reason: pause.reason };
    }
  }

  // 3b) Suppression check — frequency cap + quiet hours. Only the two
  //     customer-facing comm actions are subject; operator notifications +
  //     wait + update-field + create-task are internal and always proceed.
  //     A 'defer' decision reschedules the SAME action at the deferred-until
  //     time without advancing position; a 'skip' decision advances like
  //     dispatchAction returning {kind:'skipped'}.
  const commChannel = commChannelFor(action.action_type);
  if (commChannel) {
    const suppression = await checkSuppressionForCommAction(run, action, commChannel);
    if (suppression.kind === 'defer') {
      const delayMs = Math.max(0, suppression.untilMs - Date.now());
      const payload: AutomationActionJobPayload = { runId };
      await enqueueJob(AUTOMATION_ACTION_JOB, payload, {
        provider: 'automations',
        clientId: run.client_id,
        runAfter: new Date(Date.now() + delayMs),
        correlationId: runId,
      });
      // Don't advance position — the same action runs again after the defer.
      return { kind: 'completed', runId };
    }
    if (suppression.kind === 'skip') {
      // Skip-and-advance — same flow as dispatchAction returning skipped.
      // Move to the next action; the run stays healthy.
      const nextResolved = await resolveActionForRun(run, run.current_action_position + 1);
      if (nextResolved === 'lookup_failed' || !nextResolved) {
        await db
          .from('automation_runs')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', runId);
        return { kind: 'completed', runId };
      }
      await db
        .from('automation_runs')
        .update({ current_action_position: nextResolved.position })
        .eq('id', runId);
      const payload: AutomationActionJobPayload = { runId };
      await enqueueJobImmediate(AUTOMATION_ACTION_JOB, payload, {
        provider: 'automations',
        clientId: run.client_id,
        correlationId: runId,
      });
      return { kind: 'completed', runId };
    }
  }

  // 4) Execute the action.
  try {
    const outcome = await dispatchAction({ run, action });
    if (outcome.kind === 'skipped') {
      // Action handler decided this action shouldn't run (e.g. missing data).
      // Treat as success and advance.
    }
    // Snapshot the moment of an outbound automation message so subsequent
    // pre-flight checks can compare lead.last_inbound_at against this.
    const lastAutoMessageAt =
      action.action_type === 'send_sms_to_lead' || action.action_type === 'send_email_to_lead'
        ? new Date().toISOString()
        : run.last_automation_message_at;

    // 5) Advance — either to the next action (immediate or deferred for
    //    wait_for_duration) or to terminal completed. Resolve the NEXT
    //    valid slot via the snapshotted sequence so a mid-run delete of
    //    a later action doesn't crash the run — the engine skips past
    //    missing ids and lands on the next still-existing one.
    const nextResolved = await resolveActionForRun(run, run.current_action_position + 1);
    if (nextResolved === 'lookup_failed' || !nextResolved) {
      await db
        .from('automation_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          last_automation_message_at: lastAutoMessageAt,
        })
        .eq('id', runId);
      return { kind: 'completed', runId };
    }
    const nextPosition = nextResolved.position;

    await db
      .from('automation_runs')
      .update({
        current_action_position: nextPosition,
        last_automation_message_at: lastAutoMessageAt,
      })
      .eq('id', runId);

    // Schedule the next action — defer if outcome carries a delayMs.
    const payload: AutomationActionJobPayload = { runId };
    if (outcome.kind === 'wait' && outcome.delayMs > 0) {
      await enqueueJob(AUTOMATION_ACTION_JOB, payload, {
        provider: 'automations',
        clientId: run.client_id,
        runAfter: new Date(Date.now() + outcome.delayMs),
        correlationId: runId,
      });
    } else {
      await enqueueJobImmediate(AUTOMATION_ACTION_JOB, payload, {
        provider: 'automations',
        clientId: run.client_id,
        correlationId: runId,
      });
    }
    return { kind: 'completed', runId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, `action_failed:${message}`);
    return { kind: 'failed', runId, error: message };
  }
}

// --- shouldPauseForHumanActivity -------------------------------------------

export type PauseDecision = {
  reason: 'client_took_over' | 'lead_replied';
};

/**
 * Returns a pause decision if the next automation message on this lead would
 * step on a human — either the lead replied OR the client manually messaged.
 *
 * Three checks (any one trips the pause):
 *   1) leads.automation_state == 'taken_over'      → client_took_over
 *   2) leads.last_inbound_at > last_automation_message_at_for_run → lead_replied
 *   3) leads.last_outbound_at is from a HUMAN action newer than N hours
 *      (a manual reply pre-takeover, before the takeover flag was wired)
 *
 * Check 3 is a belt-and-braces guard for environments where the inbox doesn't
 * call takeoverLead. AUTOMATION_PAUSE_AFTER_MANUAL_HOURS controls the window.
 */
export async function shouldPauseForHumanActivity(
  leadId: string | null,
  lastAutomationMessageAt: string | null,
): Promise<PauseDecision | null> {
  if (!leadId) return null; // No lead bound — nothing to defer to.

  const db = getIntegrationDb();
  const { data, error } = await db
    .from('leads')
    .select('automation_state, last_inbound_at, last_outbound_at')
    .eq('id', leadId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    automation_state: string | null;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
  };

  if (row.automation_state === 'taken_over') {
    return { reason: 'client_took_over' };
  }

  if (row.last_inbound_at) {
    const inboundMs = Date.parse(row.last_inbound_at);
    const lastAutoMs = lastAutomationMessageAt ? Date.parse(lastAutomationMessageAt) : 0;
    if (Number.isFinite(inboundMs) && inboundMs > lastAutoMs) {
      return { reason: 'lead_replied' };
    }
  }

  // Belt + braces — recent OUTBOUND newer than the last automation message
  // means a manual outbound landed without flipping automation_state. Treat
  // as a takeover.
  if (row.last_outbound_at && lastAutomationMessageAt) {
    const lastOutMs = Date.parse(row.last_outbound_at);
    const lastAutoMs = Date.parse(lastAutomationMessageAt);
    const windowMs = pauseAfterManualMs();
    if (
      Number.isFinite(lastOutMs) &&
      Number.isFinite(lastAutoMs) &&
      lastOutMs > lastAutoMs + 1000 && // 1s grace for clock skew
      Date.now() - lastOutMs < windowMs
    ) {
      return { reason: 'client_took_over' };
    }
  }

  return null;
}

// --- helpers ---------------------------------------------------------------

/**
 * Resolve the next executable action for a run, starting from `startPosition`
 * (1-indexed). Walks the run's snapshotted `action_sequence` forward, returning
 * the first action whose id still exists in `automation_actions`.
 *
 * Skip-missing semantics: an action id that was in the sequence but whose row
 * has since been deleted is silently skipped — the run continues with the
 * next still-existing id rather than crashing. This is the one place a
 * mid-run mutation to the underlying actions can affect a live run: a
 * delete removes a slot, an insert / reorder doesn't.
 *
 * Backwards compat: a run with an empty `action_sequence` (legacy / pre-0080)
 * falls back to a live `automation_actions` lookup by position.
 *
 * Return value:
 *   • `{ action, position }` — next action + its 1-indexed slot in the sequence.
 *   • `null`                 — no more actions to execute (run is complete).
 *   • `'lookup_failed'`      — DB error — caller should fail the run.
 */
async function resolveActionForRun(
  run: AutomationRunRow,
  startPosition: number,
): Promise<{ action: AutomationActionRow; position: number } | null | 'lookup_failed'> {
  const db = getIntegrationDb();
  const sequence = run.action_sequence ?? [];

  // Legacy / pre-0080: no snapshot, fall back to live query by position.
  if (sequence.length === 0) {
    const { data, error } = await db
      .from('automation_actions')
      .select('*')
      .eq('automation_id', run.automation_id)
      .eq('position', startPosition)
      .maybeSingle();
    if (error) return 'lookup_failed';
    if (!data) return null;
    return { action: data as unknown as AutomationActionRow, position: startPosition };
  }

  // Walk the snapshotted ids forward from startPosition. Past the end → done.
  for (let pos = startPosition; pos <= sequence.length; pos += 1) {
    const actionId = sequence[pos - 1];
    if (!actionId) continue;
    const { data, error } = await db
      .from('automation_actions')
      .select('*')
      .eq('id', actionId)
      .maybeSingle();
    if (error) return 'lookup_failed';
    // Missing row → operator deleted this action after the run started.
    // Skip and try the next slot.
    if (!data) continue;
    return { action: data as unknown as AutomationActionRow, position: pos };
  }
  return null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function failRun(runId: string, message: string): Promise<void> {
  await getIntegrationDb()
    .from('automation_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: message.slice(0, 1000),
    })
    .eq('id', runId);
}

type FilterContext = {
  hasPhone: boolean;
  hasEmail: boolean;
  hasGbpLocation: boolean;
  triggerEvent: Record<string, unknown>;
};

function checkFilters(
  filters: Record<string, unknown>,
  ctx: FilterContext,
): { ok: true } | { ok: false; reason: string } {
  if (filters.requires_phone === true && !ctx.hasPhone) {
    return { ok: false, reason: 'requires_phone' };
  }
  if (filters.requires_no_phone === true && ctx.hasPhone) {
    return { ok: false, reason: 'requires_no_phone' };
  }
  if (filters.requires_email === true && !ctx.hasEmail) {
    return { ok: false, reason: 'requires_email' };
  }
  // PR B.6 (migration 0110) — email-fallback gate. The default
  // automation library prefers email; SMS-fallback actions carry
  // `requires_no_email: true` so they only fire when there is no email
  // on file for the lead. Prevents both channels from sending for a
  // lead that has both.
  if (filters.requires_no_email === true && ctx.hasEmail) {
    return { ok: false, reason: 'requires_no_email' };
  }
  if (filters.requires_gbp_location === true && !ctx.hasGbpLocation) {
    return { ok: false, reason: 'requires_gbp_location' };
  }
  // job_status_changed uses trigger_config.to_status, but the filter
  // is encoded here too for some defaults (e.g. arrival notification).
  // The automation's trigger_config.to_status is checked in the engine
  // by reading trigger_config directly — we still surface a row-level filter
  // for downstream variants.
  return { ok: true };
}

async function clientHasGbpLocation(clientId: string): Promise<boolean> {
  const db = getIntegrationDb();
  const { data } = await db
    .from('client_gbp_locations')
    .select('client_id')
    .eq('client_id', clientId)
    .maybeSingle();
  return !!data;
}

async function fetchLeadSnapshot(leadId: string): Promise<LeadSnapshot | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('leads')
    .select(
      'id, client_id, customer_id, customer_name_snapshot, customer_phone_snapshot, status, automation_state, last_inbound_at, last_outbound_at, customer:customers(email)',
    )
    .eq('id', leadId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as {
    id: string;
    client_id: string;
    customer_id: string | null;
    customer_name_snapshot: string | null;
    customer_phone_snapshot: string | null;
    status: string | null;
    automation_state: string | null;
    last_inbound_at: string | null;
    last_outbound_at: string | null;
    customer: { email: string | null } | null;
  };
  return {
    id: row.id,
    clientId: row.client_id,
    customerId: row.customer_id,
    customerName: row.customer_name_snapshot ?? '',
    customerPhone: row.customer_phone_snapshot,
    customerEmail: row.customer?.email ?? null,
    status: row.status ?? 'new',
    automationState: ((row.automation_state ?? 'automated') as LeadSnapshot['automationState']),
    lastInboundAt: row.last_inbound_at,
    lastOutboundAt: row.last_outbound_at,
  };
}

/** Map an action_type to a comm channel for suppression — null for non-comm
 *  actions, which skip the suppression check entirely. */
function commChannelFor(actionType: AutomationActionRow['action_type']): CommChannel | null {
  if (actionType === 'send_sms_to_lead') return 'sms';
  if (actionType === 'send_email_to_lead') return 'email';
  return null;
}

// Re-export for callers that only want the helper layer.
export { ACTION_PAUSES_ON_HUMAN_ACTIVITY };
