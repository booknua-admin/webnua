// =============================================================================
// Action handler — send_sms_to_lead (Phase 8 Session 1; Session 2 inline body).
//
// Enqueues the existing send_sms job (Phase 7 Twilio session). The actual
// SMS send is unchanged — the engine just orchestrates the enqueue.
//
// Phase 8 Session 2: the body now travels with the payload. `action_config`
// carries the per-client edited body (defaults from
// `lib/automations/platform-defaults.ts`); the SMS template lookup tables are
// gone. `template_key` stays on `action_config` as a free-text label so the
// integration_call_log + the editor's `// {template_key}` step header keep
// working.
//
// When `action_config.writes_gbp_review_request_audit` is true (i.e. this is
// a review_request automation), the handler also writes a
// gbp_review_requests audit row so the existing GBP attribution + nudge
// counters still light up.
// =============================================================================

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { SEND_SMS_JOB, type SendSmsPayload } from '@/lib/integrations/twilio/job-types';
import { insertReviewRequest } from '@/lib/integrations/gbp/review-requests';
import { getReviewLinkForClient } from '@/lib/integrations/gbp/locations';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import { recordOutboundOnLead } from '../handoff';

import type { ActionContext, ActionOutcome } from './dispatch';

type SendSmsActionConfig = {
  template_key?: string;
  /** The pre-rendered SMS body (with {{var}} placeholders). Session 2: this
   *  is the live edit target — the operator/client edits it on action_config
   *  via the inline editor in the automation detail. */
  body?: string;
  writes_gbp_review_request_audit?: boolean;
};

export async function runSendSmsToLead(ctx: ActionContext): Promise<ActionOutcome> {
  const cfg = ctx.action.action_config as SendSmsActionConfig;
  if (!cfg.body || cfg.body.trim().length === 0) {
    return { kind: 'skipped', reason: 'missing_body' };
  }

  // Resolve the recipient phone — prefer the trigger_event snapshot (already
  // sourced from customers at trigger time), fall back to the lead row.
  const event = ctx.run.trigger_event as Record<string, unknown>;
  let phone = typeof event.recipientPhone === 'string' ? event.recipientPhone : '';
  const leadId = ctx.run.lead_id;

  if (!phone && leadId) {
    const db = getIntegrationDb();
    const { data } = await db
      .from('leads')
      .select('customer_phone_snapshot, customer:customers(phone)')
      .eq('id', leadId)
      .maybeSingle();
    const row = data as
      | { customer_phone_snapshot: string | null; customer: { phone: string | null } | null }
      | null;
    phone = row?.customer_phone_snapshot ?? row?.customer?.phone ?? '';
  }

  if (!phone) {
    return { kind: 'skipped', reason: 'no_recipient_phone' };
  }

  // Best-effort GBP audit when this is a review-request automation. The
  // review_link is required on the row; resolve it now so the audit reflects
  // what the customer will see.
  if (cfg.writes_gbp_review_request_audit) {
    try {
      const reviewLink = (await getReviewLinkForClient(ctx.run.client_id)) ?? '';
      await insertReviewRequest({
        client_id: ctx.run.client_id,
        booking_id: typeof event.bookingId === 'string' ? event.bookingId : null,
        lead_id: leadId,
        recipient_phone: phone,
        channel: 'sms',
        status: 'queued',
        review_link: reviewLink,
      });
    } catch (auditError) {
      // The audit row is not load-bearing — log and continue. The send
      // either succeeds (the only behaviour the customer sees) or fails
      // via the send_sms handler's own audit path.
      console.warn(
        '[automations.send_sms] gbp_review_request audit failed',
        auditError instanceof Error ? auditError.message : auditError,
      );
    }
  }

  const payload: SendSmsPayload = {
    clientId: ctx.run.client_id,
    body: cfg.body,
    templateKey: cfg.template_key,
    recipientPhone: phone,
    relatedLeadId: leadId,
  };
  await enqueueJobImmediate(SEND_SMS_JOB, payload, {
    provider: 'twilio',
    clientId: ctx.run.client_id,
    correlationId: ctx.run.id,
  });

  // Update the lead's last_outbound_at so the cold-lead scanner sees it.
  await recordOutboundOnLead(leadId);

  return { kind: 'ok' };
}
