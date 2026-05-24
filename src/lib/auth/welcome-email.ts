// =============================================================================
// Welcome email — fires AFTER a Pattern B client clicks publish and the
// Stripe subscription activates. The customer just paid; this is the "your
// site is live + here's what's next" celebration email.
//
// (Pre-Pattern-B this email was the entry point — fired post-Stripe-Checkout
// during signup. Pattern B moves the magic link into `verification-email.ts`
// which fires at sign-up time, free. This module's send fires from the
// publish path inside the Stripe webhook handler.)
//
// Sister of `lib/integrations/stripe/notify.ts` — minimal inline Resend send
// via `callExternal`. Degrades to 'skipped' when RESEND_API_KEY is unset
// (the activation already happened; the email is best-effort confirmation).
// Never throws.
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';

export type WelcomeEmailInput = {
  recipientEmail: string;
  businessName: string;
  /** The public site URL (e.g. `https://acme.webnua.dev`) — included in the
   *  email so the customer can click straight through to see it live. */
  liveSiteUrl: string;
  /** The dashboard URL (e.g. `https://app.webnua.com/dashboard`) for the
   *  "next steps" CTA. */
  dashboardUrl: string;
};

export type WelcomeEmailOutcome = 'sent' | 'failed' | 'skipped';

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: WelcomeEmailInput): string {
  const safeName = escape(input.businessName);
  const safeSite = escape(input.liveSiteUrl);
  const safeDash = escape(input.dashboardUrl);
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#1e6b3a;font-weight:700;margin-bottom:14px;">// You&rsquo;re live</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">${safeName} is published.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Your subscription is active and your site is live. Customers landing on your URL will see the published version (no preview watermark, no form throttle).</p>
    <p style="margin:0 0 22px 0;">
      <a href="${safeSite}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">View your live site →</a>
    </p>
    <p style="font-size:13px;line-height:1.55;color:#4a4a45;margin:0 0 14px 0;"><strong>What&rsquo;s next:</strong></p>
    <ul style="font-size:13px;line-height:1.6;color:#4a4a45;margin:0 0 22px 18px;padding:0;">
      <li>Connect your Google Business Profile so reviews start flowing in</li>
      <li>Connect Meta so your operator can launch your first ad campaign</li>
      <li>Replies + automations are already wired — leads land in your inbox</li>
    </ul>
    <p style="margin:0 0 22px 0;">
      <a href="${safeDash}" style="display:inline-block;border:1px solid #c9c0b0;background:#ffffff;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;">Open your dashboard →</a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0;">Manage your subscription, card, and invoices any time from Settings → Billing.</p>
  </div>
  <div style="text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;margin-top:18px;">&copy; Webnua &middot; Perth</div>
</body></html>`;
}

function buildText(input: WelcomeEmailInput): string {
  return [
    `${input.businessName} is published.`,
    '',
    'Your subscription is active and your site is live. Customers landing on your URL will see the published version (no preview watermark, no form throttle).',
    '',
    `View your live site: ${input.liveSiteUrl}`,
    '',
    "What's next:",
    '  - Connect your Google Business Profile so reviews start flowing in',
    '  - Connect Meta so your operator can launch your first ad campaign',
    '  - Replies + automations are already wired — leads land in your inbox',
    '',
    `Open your dashboard: ${input.dashboardUrl}`,
    '',
    'Manage your subscription, card, and invoices any time from Settings → Billing.',
    '',
    '— Webnua',
  ].join('\n');
}

/** Send the post-publish welcome email. Never throws — failure surfaces
 *  through the return value so the Stripe webhook can ack 200 regardless. */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<WelcomeEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[welcome-email] RESEND_API_KEY unset — publish welcome email skipped for ${input.recipientEmail}`,
    );
    return 'skipped';
  }

  const from = `Webnua <welcome@${env.EMAIL_SENDING_DOMAIN}>`;
  const result = await callExternal<{ id?: string }>({
    provider: 'resend',
    operation: 'send_publish_welcome_email',
    url: 'https://api.resend.com/emails',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from,
      to: input.recipientEmail,
      subject: `${input.businessName} is live`,
      html: buildHtml(input),
      text: buildText(input),
    },
    clientId: null,
  });

  if (!result.ok) {
    console.warn(
      `[welcome-email] Resend send failed for ${input.recipientEmail}: ${result.error.message}`,
    );
    return 'failed';
  }
  return 'sent';
}
