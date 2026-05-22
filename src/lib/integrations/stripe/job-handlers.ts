// =============================================================================
// Stripe billing — job handlers.
//
// Phase 7 Stripe billing session. Side-effect module: registers the job
// handlers the Stripe integration owns. Imported by job-handler-manifest.ts so
// the registration lands in the job executor's module graph.
//
//   stripe_payment_failed_notify — enqueued by the Stripe webhook on
//   invoice.payment_failed. Emails the operator(s) that a client's payment
//   failed and that they have a 7-day grace window before access is gated.
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { registerJobHandler } from '@/lib/integrations/_shared/jobs';
import { getAppBaseUrl } from '@/lib/env';

import { STRIPE_PAYMENT_FAILED_JOB, type StripePaymentFailedPayload } from './job-types';
import { sendOperatorEmail } from './notify';

/** Minimal HTML escape for interpolated values. */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

registerJobHandler(STRIPE_PAYMENT_FAILED_JOB, async (payload) => {
  const { clientId, invoiceId } = (payload ?? {}) as StripePaymentFailedPayload;
  if (!clientId) {
    throw new Error('stripe_payment_failed_notify: payload missing clientId');
  }

  const db = getIntegrationDb();

  // Resolve the client name for the email copy.
  const { data: client } = await db.from('clients').select('name').eq('id', clientId).maybeSingle();
  const clientName = (client as { name?: string } | null)?.name ?? 'a client';

  // Recipients — every operator (admin-role) user. The platform is
  // single-operator in V1; emailing all admins is the simple correct choice.
  const { data: operators, error } = await db.from('users').select('email').eq('role', 'admin');
  if (error) {
    throw new Error(`stripe_payment_failed_notify: operator lookup failed — ${error.message}`);
  }
  const recipients = (operators ?? []) as { email: string }[];
  if (recipients.length === 0) {
    return { recipients: 0, sent: 0, failed: 0, skipped: 0, note: 'no operator users' };
  }

  const base = getAppBaseUrl();
  const billingLink = `${base ?? ''}/settings/billing`;
  const subject = `Payment failed — ${clientName}`;
  const html =
    `<p>A subscription payment failed for <strong>${escapeHtml(clientName)}</strong>.</p>` +
    `<p>They have 7 days before access is suspended. Review their billing and ` +
    `follow up with the client to update their payment method.</p>` +
    `<p><a href="${escapeHtml(billingLink)}">View billing</a></p>` +
    (invoiceId
      ? `<p style="color:#6e685c;font-size:12px">Stripe invoice: ${escapeHtml(invoiceId)}</p>`
      : '');

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    const outcome = await sendOperatorEmail({
      clientId,
      recipientEmail: recipient.email,
      subject,
      html,
      templateName: 'stripe_payment_failed',
    });
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'failed') failed += 1;
    else skipped += 1;
  }
  return { recipients: recipients.length, sent, failed, skipped };
});

export {};
