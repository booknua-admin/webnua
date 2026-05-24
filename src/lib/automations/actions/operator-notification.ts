// =============================================================================
// Action handler — send_operator_notification (Phase 8 Session 1).
//
// Two variants:
//   • new_lead       — enqueues the existing send_lead_notification job.
//                      Same throttle + digest path as before — the existing
//                      handler does the work, the engine just orchestrates.
//   • payment_failed — enqueues the existing stripe_payment_failed_notify job.
//
// Internal action — does NOT pause on human activity (always fires).
// =============================================================================

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { SEND_LEAD_NOTIFICATION_JOB } from '@/lib/integrations/resend/job-types';
import { STRIPE_PAYMENT_FAILED_JOB } from '@/lib/integrations/stripe/job-types';

import type { ActionContext, ActionOutcome } from './dispatch';
import type { OperatorNotificationActionConfig } from '../engine-types';

export async function runSendOperatorNotification(
  ctx: ActionContext,
): Promise<ActionOutcome> {
  const cfg = ctx.action.action_config as OperatorNotificationActionConfig;
  const event = ctx.run.trigger_event as Record<string, unknown>;

  if (cfg.variant === 'new_lead') {
    const leadId = ctx.run.lead_id ?? (typeof event.leadId === 'string' ? event.leadId : null);
    if (!leadId) return { kind: 'skipped', reason: 'no_lead_id' };
    await enqueueJobImmediate(
      SEND_LEAD_NOTIFICATION_JOB,
      { clientId: ctx.run.client_id, leadId },
      { provider: 'resend', clientId: ctx.run.client_id, correlationId: ctx.run.id },
    );
    return { kind: 'ok' };
  }

  if (cfg.variant === 'payment_failed') {
    const invoiceId = typeof event.invoiceId === 'string' ? event.invoiceId : undefined;
    await enqueueJobImmediate(
      STRIPE_PAYMENT_FAILED_JOB,
      { clientId: ctx.run.client_id, invoiceId },
      { provider: 'stripe', clientId: ctx.run.client_id, correlationId: ctx.run.id },
    );
    return { kind: 'ok' };
  }

  return { kind: 'skipped', reason: `unknown_variant:${String(cfg.variant)}` };
}
