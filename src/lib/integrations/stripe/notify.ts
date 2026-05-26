// =============================================================================
// Stripe billing — operator notification email.
//
// Phase 7 Stripe billing session. Sends a transactional email to an operator
// and records it in notifications_outbound (the foundation's external-email
// send log, migration 0053).
//
// MINIMAL inline Resend send. The full Resend integration — a reusable email
// module with templates and delivery-webhook reconciliation — is a separate
// Phase 7 session. This is just the one transactional send the Stripe billing
// flow needs; it goes through callExternal() (so it is logged + retried) and
// degrades gracefully when RESEND_API_KEY is unset (the email is skipped, not
// faked). When the Resend session lands, route this through it.
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

export type OperatorEmailInput = {
  /** Tenant the email concerns — for the call-log + send-log attribution. */
  clientId: string;
  recipientEmail: string;
  subject: string;
  /** HTML body — the branded surface a modern mail client renders. */
  html: string;
  /** Plain-text alt — what a text-only client renders. Strongly recommended;
   *  Resend will derive one from the HTML if omitted, but a hand-authored
   *  text alt reads better and avoids HTML tags leaking through. */
  text?: string;
  /** notifications_outbound.template_name. */
  templateName: string;
};

/** 'sent' / 'failed' = a send was attempted (and logged to
 *  notifications_outbound); 'skipped' = RESEND_API_KEY is unset, no send. */
export type OperatorEmailOutcome = 'sent' | 'failed' | 'skipped';

/** Send one operator email via Resend and record it in notifications_outbound.
 *  Never throws — a send failure is reported through the return value so the
 *  caller (a job handler) can continue to the next recipient. */
export async function sendOperatorEmail(input: OperatorEmailInput): Promise<OperatorEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[stripe/notify] RESEND_API_KEY unset — operator email skipped: "${input.subject}"`,
    );
    return 'skipped';
  }

  const from = `Webnua Billing <billing@${env.EMAIL_SENDING_DOMAIN}>`;
  const body: Record<string, unknown> = {
    from,
    to: input.recipientEmail,
    subject: input.subject,
    html: input.html,
  };
  if (input.text) body.text = input.text;
  const result = await callExternal<{ id?: string }>({
    provider: 'resend',
    operation: 'send_email',
    url: 'https://api.resend.com/emails',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    clientId: input.clientId,
  });

  const status: 'sent' | 'failed' = result.ok ? 'sent' : 'failed';
  if (!result.ok) {
    console.warn(
      `[stripe/notify] Resend send failed for ${input.recipientEmail}: ${result.error.message}`,
    );
  }

  // notifications_outbound — the external-email send log (throttle + audit).
  try {
    await getIntegrationDb()
      .from('notifications_outbound')
      .insert({
        client_id: input.clientId,
        recipient_email: input.recipientEmail,
        template_name: input.templateName,
        status,
        resend_message_id: result.ok ? (result.data.id ?? null) : null,
      });
  } catch (error) {
    console.warn('[stripe/notify] notifications_outbound write failed', error);
  }

  return status;
}
