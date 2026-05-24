// =============================================================================
// Automation engine — action dispatcher (Phase 8 Session 1).
//
// Routes one action of one run to the matching action handler. Handlers are
// pure-ish — they read the run + the action, do the work, and return an
// outcome the engine uses to schedule the next step.
//
// All handlers are server-side — they read the service-role client. Each
// handler is intentionally short; the real work (sending SMS, sending
// email, fanning operator notifications) lives in the existing integration
// job handlers, which the action dispatchers enqueue.
// =============================================================================

import type { AutomationActionRow, AutomationRunRow } from '../engine-types';

import { runSendSmsToLead } from './send-sms';
import { runSendEmailToLead } from './send-email';
import { runSendOperatorNotification } from './operator-notification';
import { runWaitForDuration } from './wait';
import { runUpdateLeadField } from './update-field';
import { runCreateFollowupTask } from './create-followup-task';

/** Outcome of one action. The engine uses `wait.delayMs` to defer the next
 *  action; everything else schedules immediately. `skipped` is success — the
 *  handler decided this run shouldn't have fired (e.g. missing data) but the
 *  run as a whole stays healthy. */
export type ActionOutcome =
  | { kind: 'ok' }
  | { kind: 'wait'; delayMs: number }
  | { kind: 'skipped'; reason: string };

export type ActionContext = {
  run: AutomationRunRow;
  action: AutomationActionRow;
};

/** Dispatch one action to its handler. Handlers may throw — the engine
 *  catches and marks the run failed. */
export async function dispatchAction(ctx: ActionContext): Promise<ActionOutcome> {
  switch (ctx.action.action_type) {
    case 'send_sms_to_lead':
      return runSendSmsToLead(ctx);
    case 'send_email_to_lead':
      return runSendEmailToLead(ctx);
    case 'send_operator_notification':
      return runSendOperatorNotification(ctx);
    case 'wait_for_duration':
      return runWaitForDuration(ctx);
    case 'update_lead_field':
      return runUpdateLeadField(ctx);
    case 'create_followup_task':
      return runCreateFollowupTask(ctx);
    default: {
      // TypeScript's exhaustiveness check would catch a new action type at
      // compile time; the runtime guard is for the jsonb action_config path.
      const unknownType: never = ctx.action.action_type;
      throw new Error(`dispatchAction: unknown action_type "${unknownType as string}"`);
    }
  }
}
