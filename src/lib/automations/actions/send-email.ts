// =============================================================================
// Action handler — send_email_to_lead (Phase 8 Session 1; Session 2 inline body).
//
// Sibling of send-sms.ts. Phase 8 Session 2: the subject + body_html +
// body_text now travel with the payload; `action_config` is the source of
// truth (defaults from `lib/automations/platform-defaults.ts`). The
// email_templates table is gone.
//
// When the action is a review-request fallback (no-phone path), writes a
// gbp_review_requests audit row with channel='email'.
// =============================================================================

import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { SEND_EMAIL_JOB, type SendEmailPayload } from '@/lib/integrations/resend/job-types';
import type { EmailTemplateKey } from '@/lib/integrations/resend/types';
import { insertReviewRequest } from '@/lib/integrations/gbp/review-requests';
import { getReviewLinkForClient } from '@/lib/integrations/gbp/locations';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import { recordOutboundOnLead } from '../handoff';

import type { ActionContext, ActionOutcome } from './dispatch';

type SendEmailActionConfig = {
  template_key?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  writes_gbp_review_request_audit?: boolean;
};

export async function runSendEmailToLead(ctx: ActionContext): Promise<ActionOutcome> {
  const cfg = ctx.action.action_config as SendEmailActionConfig;

  // An email needs a subject + at least one body variant. Skip honestly if
  // either is missing rather than send half a message.
  const hasBody =
    (typeof cfg.body_html === 'string' && cfg.body_html.trim().length > 0) ||
    (typeof cfg.body_text === 'string' && cfg.body_text.trim().length > 0);
  if (!cfg.subject || !hasBody) {
    return { kind: 'skipped', reason: 'missing_subject_or_body' };
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

  // The send_email job handler accepts customer-facing keys (lead_followup
  // and review_request). For the review-request flow we tag as
  // `review_request`; everything else flows as `lead_followup`. The exact
  // key drives the inbound-reply threading + the audit's templateName.
  const templateKey: EmailTemplateKey = cfg.writes_gbp_review_request_audit
    ? 'review_request'
    : (cfg.template_key as EmailTemplateKey | undefined) ?? 'lead_followup';

  const payload: SendEmailPayload = {
    clientId: ctx.run.client_id,
    templateKey,
    recipientEmail: email,
    recipientName: name || 'there',
    relatedLeadId: leadId,
    // Forward bookingId for job_scheduled / job_status_changed / job_completed
    // triggers — the handler resolves `{{job.*}}` against the booking row.
    relatedBookingId: typeof event.bookingId === 'string' ? event.bookingId : null,
    subject: cfg.subject,
    bodyHtml: cfg.body_html,
    bodyText: cfg.body_text,
  };

  await enqueueJobImmediate(SEND_EMAIL_JOB, payload, {
    provider: 'resend',
    clientId: ctx.run.client_id,
    correlationId: ctx.run.id,
  });

  // Update the lead's last_outbound_at so the cold-lead scanner sees it.
  await recordOutboundOnLead(leadId);

  return { kind: 'ok' };
}
