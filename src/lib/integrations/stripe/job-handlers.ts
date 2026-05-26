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
import { EMAIL_BRAND_FOOTER, EMAIL_BRAND_FOOTER_TEXT } from '@/lib/email/footer';

/** Minimal HTML escape for interpolated values. */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

/** Branded HTML body for the payment-failed operator alert. Same chrome as
 *  `lib/billing/cancellation-warning-email.ts` (paper bg, white card, rust
 *  eyebrow, mono footer) so the operator-facing email family is visually
 *  coherent. */
function buildPaymentFailedHtml(input: {
  clientName: string;
  billingLink: string;
  invoiceId: string | null;
}): string {
  const name = escapeHtml(input.clientName);
  const link = escapeHtml(input.billingLink);
  const invoice = input.invoiceId
    ? `<p style="font-size:12px;line-height:1.5;color:#6e685c;margin:18px 0 0 0;">Stripe invoice: <span style="font-family:'JetBrains Mono',ui-monospace,monospace;">${escapeHtml(input.invoiceId)}</span></p>`
    : '';
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#c44444;font-weight:700;margin-bottom:14px;">// Payment failed</div>
    <h1 style="font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">A subscription payment failed for ${name}.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Stripe will retry the charge automatically over the next few days. The client has <strong>7 days</strong> from this notice before access is suspended.</p>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;"><strong>What to do:</strong> reach out to the client and ask them to update their payment method via the Stripe billing portal. If the retry succeeds the suspension is cancelled automatically.</p>
    <p style="margin:0 0 6px 0;">
      <a href="${link}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">View billing →</a>
    </p>${invoice}
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

function buildPaymentFailedText(input: {
  clientName: string;
  billingLink: string;
  invoiceId: string | null;
}): string {
  return [
    `A subscription payment failed for ${input.clientName}.`,
    '',
    'Stripe will retry the charge automatically over the next few days. The client has 7 days from this notice before access is suspended.',
    '',
    'What to do: reach out to the client and ask them to update their payment method via the Stripe billing portal. If the retry succeeds the suspension is cancelled automatically.',
    '',
    `View billing: ${input.billingLink}`,
    ...(input.invoiceId ? ['', `Stripe invoice: ${input.invoiceId}`] : []),
    '',
    EMAIL_BRAND_FOOTER_TEXT,
  ].join('\n');
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
  const html = buildPaymentFailedHtml({ clientName, billingLink, invoiceId: invoiceId ?? null });
  const text = buildPaymentFailedText({ clientName, billingLink, invoiceId: invoiceId ?? null });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const recipient of recipients) {
    const outcome = await sendOperatorEmail({
      clientId,
      recipientEmail: recipient.email,
      subject,
      html,
      text,
      templateName: 'stripe_payment_failed',
    });
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'failed') failed += 1;
    else skipped += 1;
  }
  return { recipients: recipients.length, sent, failed, skipped };
});

export {};
