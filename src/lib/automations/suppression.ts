// =============================================================================
// Automation suppression layer (Phase 8 · Session 4).
//
// Closes the long-deferred "Automation overlap / anti-spam" parked decision.
// Three suppression dimensions, evaluated before every comm action dispatches:
//
//   1) Frequency cap        — max N sends per channel per recipient per
//                             window. V1: 1 per hour, 3 per 24h per channel.
//                             Read against sms_messages / email_messages.
//   2) Quiet hours          — per-client window on `clients`. Inside the
//                             window the action DEFERS (waits) until end of
//                             window — does not skip.
//   3) Priority cancellation — when a higher-priority run starts on a lead,
//                              cancel lower-priority running runs on that
//                              lead. Priority is hardcoded by trigger_type
//                              (+ automation_key prefix for reputation).
//
// Every suppression decision writes to automation_suppression_log so the
// "why didn't this fire" question has an audit answer. Operator
// notifications (send_operator_notification) are NEVER suppressed — they
// are internal system alerts; if those flood, the operator's preferences
// (notification_preferences digest_frequency) are the right control.
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  AutomationActionRow,
  AutomationRow,
  AutomationRunRow,
  AutomationTriggerType,
} from './engine-types';

// --- Constants -------------------------------------------------------------

/** Max sends per channel per recipient in a rolling 60-minute window. */
export const FREQUENCY_CAP_HOURLY = 1;
/** Max sends per channel per recipient in a rolling 24-hour window. */
export const FREQUENCY_CAP_DAILY = 3;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// --- Priority --------------------------------------------------------------

/** Lower number = higher priority. */
export type AutomationPriority = 1 | 2 | 3;

const TRANSACTIONAL: ReadonlySet<AutomationTriggerType> = new Set([
  'payment_failed',
  'job_completed',
  'job_scheduled',
  'job_status_changed',
]);

const NURTURE: ReadonlySet<AutomationTriggerType> = new Set([
  'lead_created',
  'lead_inactive',
]);

/**
 * Hardcoded priority by automation. CLAUDE.md "Mutual-exclusion / priority
 * tiers" sketch lifted into code:
 *   1 = transactional  (must always go through — booking confirmations etc.)
 *   2 = nurture        (lead follow-up, win-back)
 *   3 = reputation     (review requests — important but lowest priority)
 *
 * Reputation is detected by `automation_key` prefix `review_request_` because
 * it rides on the `job_completed` trigger (transactional) but is itself
 * reputation. The prefix-match keeps the rule readable without a third
 * column on `automations`.
 */
export function automationPriority(automation: AutomationRow): AutomationPriority {
  if (automation.automation_key.startsWith('review_request_')) return 3;
  if (TRANSACTIONAL.has(automation.trigger_type)) return 1;
  if (NURTURE.has(automation.trigger_type)) return 2;
  return 3;
}

// --- Suppression decision --------------------------------------------------

export type SuppressionDecision =
  | { kind: 'allow' }
  | { kind: 'skip'; reason: SuppressionReason }
  | { kind: 'defer'; untilMs: number; reason: SuppressionReason };

export type SuppressionReason =
  | 'frequency_cap_hourly'
  | 'frequency_cap_daily'
  | 'quiet_hours'
  | 'priority_cancelled';

export type CommChannel = 'sms' | 'email';

/**
 * The pre-dispatch check for every comm action. Returns one of three:
 *   • allow — proceed to dispatch
 *   • skip  — advance the run without sending; logs the decision
 *   • defer — reschedule the action; logs the decision with deferred_until
 *
 * Internal actions (operator notifications, wait, update-field, task) are
 * NOT subject to suppression — the engine routes them direct to dispatch.
 */
export async function checkSuppressionForCommAction(
  run: AutomationRunRow,
  action: AutomationActionRow,
  channel: CommChannel,
): Promise<SuppressionDecision> {
  // 1) Frequency cap on the lead.
  if (run.lead_id) {
    const freq = await checkFrequencyCap(run.lead_id, channel);
    if (freq.kind !== 'allow') {
      await logSuppression(run, action, channel, freq.reason, null, {
        windowHours: freq.reason === 'frequency_cap_hourly' ? 1 : 24,
        count: freq.count,
      });
      return { kind: 'skip', reason: freq.reason };
    }
  }

  // 2) Quiet hours on the client.
  const quiet = await checkQuietHours(run.client_id);
  if (quiet.kind === 'defer') {
    await logSuppression(run, action, channel, 'quiet_hours', new Date(quiet.untilMs), {
      windowStart: quiet.windowStart,
      windowEnd: quiet.windowEnd,
      timezone: quiet.timezone,
    });
    return { kind: 'defer', untilMs: quiet.untilMs, reason: 'quiet_hours' };
  }

  return { kind: 'allow' };
}

// --- Frequency cap ---------------------------------------------------------

type FrequencyResult =
  | { kind: 'allow' }
  | { kind: 'skip'; reason: 'frequency_cap_hourly' | 'frequency_cap_daily'; count: number };

async function checkFrequencyCap(
  leadId: string,
  channel: CommChannel,
): Promise<FrequencyResult> {
  const db = getIntegrationDb();
  const now = Date.now();
  const hourAgo = new Date(now - HOUR_MS).toISOString();
  const dayAgo = new Date(now - DAY_MS).toISOString();

  const table = channel === 'sms' ? 'sms_messages' : 'email_messages';
  // Count successful + in-flight outbound messages — `failed` doesn't count
  // against the cap (a rejected send is no message to the customer).
  // For sms_messages: every row IS outbound. For email_messages: filter to
  // direction=outbound.
  let dailyQuery = db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('related_lead_id', leadId)
    .neq('status', 'failed')
    .gte(channel === 'sms' ? 'sent_at' : 'occurred_at', dayAgo);
  if (channel === 'email') {
    dailyQuery = dailyQuery.eq('direction', 'outbound');
  }
  const { count: dailyCount, error: dailyError } = await dailyQuery;
  if (dailyError) {
    // If the count fails, fail open — a frequency-cap mis-read should NOT
    // silently drop a customer-facing message. Log the error in console;
    // an op concerned about over-sending can audit via the send log.
    console.warn(
      `[suppression] frequency-cap daily count failed for lead ${leadId}/${channel}:`,
      dailyError.message,
    );
    return { kind: 'allow' };
  }
  const daily = dailyCount ?? 0;
  if (daily >= FREQUENCY_CAP_DAILY) {
    return { kind: 'skip', reason: 'frequency_cap_daily', count: daily };
  }

  let hourlyQuery = db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('related_lead_id', leadId)
    .neq('status', 'failed')
    .gte(channel === 'sms' ? 'sent_at' : 'occurred_at', hourAgo);
  if (channel === 'email') {
    hourlyQuery = hourlyQuery.eq('direction', 'outbound');
  }
  const { count: hourlyCount, error: hourlyError } = await hourlyQuery;
  if (hourlyError) {
    console.warn(
      `[suppression] frequency-cap hourly count failed for lead ${leadId}/${channel}:`,
      hourlyError.message,
    );
    return { kind: 'allow' };
  }
  const hourly = hourlyCount ?? 0;
  if (hourly >= FREQUENCY_CAP_HOURLY) {
    return { kind: 'skip', reason: 'frequency_cap_hourly', count: hourly };
  }

  return { kind: 'allow' };
}

// --- Quiet hours -----------------------------------------------------------

type QuietHoursResult =
  | { kind: 'allow' }
  | {
      kind: 'defer';
      untilMs: number;
      windowStart: string;
      windowEnd: string;
      timezone: string;
    };

async function checkQuietHours(clientId: string): Promise<QuietHoursResult> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('clients')
    .select('quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
    .eq('id', clientId)
    .maybeSingle();
  if (error || !data) return { kind: 'allow' };
  const row = data as unknown as {
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    quiet_hours_timezone: string | null;
  };
  if (!row.quiet_hours_start || !row.quiet_hours_end) return { kind: 'allow' };
  const tz = row.quiet_hours_timezone || 'UTC';
  const now = new Date();
  const decision = computeQuietHoursWindow(
    now,
    row.quiet_hours_start,
    row.quiet_hours_end,
    tz,
  );
  if (!decision.inWindow) return { kind: 'allow' };
  return {
    kind: 'defer',
    untilMs: decision.endMs,
    windowStart: row.quiet_hours_start,
    windowEnd: row.quiet_hours_end,
    timezone: tz,
  };
}

/**
 * Pure helper — given the current instant, a start time + end time + IANA
 * timezone, decide whether `now` is inside the daily window AND when the
 * window next ends (UTC ms).
 *
 * Wrap-midnight handling: when end < start, the window crosses midnight
 * (e.g. start 22:00, end 07:00 → quiet from 22:00 through next-day 07:00).
 *
 * Exported for testability. The implementation uses Intl.DateTimeFormat
 * to read the client TZ's wall clock without pulling in a date library.
 */
export function computeQuietHoursWindow(
  now: Date,
  startTime: string,
  endTime: string,
  timezone: string,
): { inWindow: boolean; endMs: number } {
  const startMinutes = parseHM(startTime);
  const endMinutes = parseHM(endTime);
  if (startMinutes == null || endMinutes == null || startMinutes === endMinutes) {
    return { inWindow: false, endMs: 0 };
  }

  const local = getZonedParts(now, timezone);
  const localMinutes = local.hours * 60 + local.minutes;

  let inWindow: boolean;
  if (startMinutes < endMinutes) {
    inWindow = localMinutes >= startMinutes && localMinutes < endMinutes;
  } else {
    // Wraps midnight.
    inWindow = localMinutes >= startMinutes || localMinutes < endMinutes;
  }
  if (!inWindow) return { inWindow: false, endMs: 0 };

  // Compute when the window ends (in UTC ms). If we're on the post-midnight
  // side of a wrapping window, end is today's end time; otherwise also today's.
  // Strategy: same wall-clock day in client TZ, hour/minute = endMinutes.
  // If endMinutes is BEFORE the current local time (wrapping window, we're
  // pre-midnight), the end is tomorrow.
  let endDayOffset = 0;
  if (startMinutes > endMinutes && localMinutes >= startMinutes) {
    // Pre-midnight side of a wrapping window → end is tomorrow in client TZ.
    endDayOffset = 1;
  }
  const endMs = computeUtcInstantForClientWallClock(
    local.year,
    local.month,
    local.day + endDayOffset,
    Math.floor(endMinutes / 60),
    endMinutes % 60,
    timezone,
  );
  return { inWindow: true, endMs };
}

function parseHM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

function getZonedParts(
  instant: Date,
  timezone: string,
): { year: number; month: number; day: number; hours: number; minutes: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hours: get('hour') % 24,
    minutes: get('minute'),
  };
}

/**
 * Returns the UTC ms timestamp at which the wall-clock time (Y/M/D h:m) in
 * the given IANA timezone occurs. Uses an offset-probe — Intl tells us the
 * UTC offset of a probe timestamp in the target TZ; we apply it.
 */
function computeUtcInstantForClientWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): number {
  // Build a UTC instant from the wall-clock parts as if they were UTC,
  // then probe the timezone's offset at that instant, then apply.
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offsetMs = getTimezoneOffsetMs(utcMs, timezone);
  return utcMs - offsetMs;
}

function getTimezoneOffsetMs(instantMs: number, timezone: string): number {
  // Format the instant in the target TZ, parse back to UTC, the delta is
  // the offset. Standard trick — no dep required.
  const date = new Date(instantMs);
  const parts = getZonedParts(date, timezone);
  const reconstructedUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    0,
    0,
  );
  return reconstructedUtc - instantMs;
}

// --- Priority cancellation -------------------------------------------------

export type PriorityCancellationResult = {
  cancelledRunCount: number;
};

/**
 * Called by the engine after a new run is created (in onTrigger). If the new
 * run is higher priority than existing running runs on the same lead, cancel
 * the lower-priority runs. Returns how many were cancelled.
 *
 * Same-priority runs are NOT cancelled — two nurture flows on the same lead
 * are filtered out at the frequency-cap layer instead.
 */
export async function cancelLowerPriorityRuns(
  newRun: AutomationRunRow,
  newAutomation: AutomationRow,
): Promise<PriorityCancellationResult> {
  if (!newRun.lead_id) return { cancelledRunCount: 0 };
  const newPriority = automationPriority(newAutomation);

  const db = getIntegrationDb();
  // Pull all other running/paused runs on this lead, with the automation
  // joined so we can compute their priority.
  const { data, error } = await db
    .from('automation_runs')
    .select('id, automation_id, current_action_position, action_sequence, automation:automations(automation_key, trigger_type)')
    .eq('lead_id', newRun.lead_id)
    .in('status', ['running', 'paused'])
    .neq('id', newRun.id);
  if (error || !data) return { cancelledRunCount: 0 };

  type RunWithAuto = {
    id: string;
    automation_id: string;
    current_action_position: number;
    action_sequence: string[] | null;
    automation: { automation_key: string; trigger_type: AutomationTriggerType } | null;
  };
  const candidates = data as unknown as RunWithAuto[];

  const toCancel: Array<{
    runId: string;
    automationId: string;
    nextActionId: string | null;
  }> = [];
  for (const c of candidates) {
    if (!c.automation) continue;
    const otherAuto = {
      automation_key: c.automation.automation_key,
      trigger_type: c.automation.trigger_type,
    } as AutomationRow;
    const otherPriority = automationPriority(otherAuto);
    if (otherPriority <= newPriority) continue;
    // Lower priority (higher number) → cancel.
    const seq = c.action_sequence ?? [];
    const nextActionId = seq[c.current_action_position - 1] ?? null;
    toCancel.push({
      runId: c.id,
      automationId: c.automation_id,
      nextActionId,
    });
  }

  if (toCancel.length === 0) return { cancelledRunCount: 0 };

  const ids = toCancel.map((c) => c.runId);
  await db
    .from('automation_runs')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .in('id', ids);

  // Log one suppression row per cancelled run. The action_id slot carries
  // whatever was next-due on the cancelled run (or the first action if the
  // sequence is empty).
  const rows = toCancel
    .filter((c) => c.nextActionId)
    .map((c) => ({
      client_id: newRun.client_id,
      automation_id: c.automationId,
      automation_run_id: c.runId,
      action_id: c.nextActionId as string,
      lead_id: newRun.lead_id,
      channel: null,
      reason: 'priority_cancelled' as const,
      deferred_until: null,
      context: {
        higher_priority_run_id: newRun.id,
        higher_priority_automation_id: newAutomation.id,
        higher_priority_trigger: newAutomation.trigger_type,
        higher_priority_level: newPriority,
      },
    }));
  if (rows.length > 0) {
    const { error: logError } = await db
      .from('automation_suppression_log')
      .insert(rows as never);
    if (logError) {
      console.warn(
        '[suppression] failed to log priority_cancelled rows:',
        logError.message,
      );
    }
  }

  return { cancelledRunCount: ids.length };
}

// --- Log helper ------------------------------------------------------------

async function logSuppression(
  run: AutomationRunRow,
  action: AutomationActionRow,
  channel: CommChannel,
  reason: SuppressionReason,
  deferredUntil: Date | null,
  context: Record<string, unknown>,
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db.from('automation_suppression_log').insert({
    client_id: run.client_id,
    automation_id: run.automation_id,
    automation_run_id: run.id,
    action_id: action.id,
    lead_id: run.lead_id,
    channel,
    reason,
    deferred_until: deferredUntil ? deferredUntil.toISOString() : null,
    context,
  } as never);
  if (error) {
    console.warn(
      `[suppression] failed to log ${reason} for run ${run.id}:`,
      error.message,
    );
  }
}
