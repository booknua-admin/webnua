// =============================================================================
// Action handler — send_email_to_lead (Phase 8 Session 1).
//
// Enqueues the existing send_email job (Phase 7 Resend session). Sibling of
// send-sms.ts: same shape, email channel. When the action is a review-request
// fallback (no-phone path), writes a gbp_review_requests audit row with
// channel='email'.
// =============================================================================

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { SEND_EMAIL_JOB } from '@/lib/integrations/resend/job-types';
import { insertReviewRequest } from '@/lib/integrations/gbp/review-requests';
import { getReviewLinkForClient } from '@/lib/integrations/gbp/locations';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import { recordOutboundOnLead } from '../handoff';

import type { ActionContext, ActionOutcome } from './dispatch';
import type { SendEmailActionConfig } from '../engine-types';

export async function runSendEmailToLead(ctx: ActionContext): Promise<ActionOutcome> {
  const cfg = ctx.action.action_config as SendEmailActionConfig;
  if (!cfg.template_key) {
    return { kind: 'skipped', reason: 'missing_template_key' };
  }

  const event = ctx.run.trigger_event as Record<string, unknown>;
  let email = typeof event.recipientEmail === 'string' ? event.recipientEmail : '';
  let name = typeof event.recipientName === 'string' ? event.recipientName : '';
  const leadId = ctx.run.lead_id;

  if ((!email || !name) && leadId) {
    const db = getIntegrationDb();
    const { data } = await db
      .from('leads')
      .select('customer_name_snapshot, customer:customers(email, name)')
      .eq('id', leadId)
      .maybeSingle();
    const row = data as
      | {
          customer_name_snapshot: string | null;
          customer: { email: string | null; name: string | null } | null;
        }
      | null;
    email = email || row?.customer?.email || '';
    name = name || row?.customer_name_snapshot || row?.customer?.name || '';
  }

  if (!email) {
    return { kind: 'skipped', reason: 'no_recipient_email' };
  }

  if (cfg.writes_gbp_review_request_audit) {
    try {
      const reviewLink = (await getReviewLinkForClient(ctx.run.client_id)) ?? '';
      await insertReviewRequest({
        client_id: ctx.run.client_id,
        booking_id: typeof event.bookingId === 'string' ? event.bookingId : null,
        lead_id: leadId,
        recipient_email: email,
        recipient_name: name || null,
        channel: 'email',
        status: 'queued',
        review_link: reviewLink,
      });
    } catch (auditError) {
      console.warn(
        '[automations.send_email] gbp_review_request audit failed',
        auditError instanceof Error ? auditError.message : auditError,
      );
    }
  }

  await enqueueJobImmediate(
    SEND_EMAIL_JOB,
    {
      clientId: ctx.run.client_id,
      templateKey: cfg.template_key,
      recipientEmail: email,
      recipientName: name || 'there',
      relatedLeadId: leadId,
    },
    {
      provider: 'resend',
      clientId: ctx.run.client_id,
      correlationId: ctx.run.id,
    },
  );

  // Update the lead's last_outbound_at so the cold-lead scanner sees it.
  await recordOutboundOnLead(leadId);

  return { kind: 'ok' };
}
