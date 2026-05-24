// =============================================================================
// Re-engagement email — Pattern B's 7-day "still here? publish to go live" nudge.
//
// Fires from the `send_re_engagement_email` integration_jobs handler, which
// is enqueued by the daily `webnua_re_engagement_scan` pg_cron (migration
// 0086). The cron picks clients in 'preview' state whose `created_at < now()
// - 7 days` AND `re_engagement_sent_at IS NULL`. The handler sends this email
// then stamps `re_engagement_sent_at = now()` so the next scan skips them
// (send-once-per-client).
//
// Sister of `verification-email.ts` + `welcome-email.ts` — minimal inline
// Resend send via `callExternal`. Degrades to 'skipped' when key unset.
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';

export type ReEngagementEmailInput = {
  recipientEmail: string;
  businessName: string;
  /** The customer's dashboard URL (e.g. `https://app.webnua.com/dashboard`)
   *  — the CTA opens it so they can re-enter the wizard / hit Publish. */
  dashboardUrl: string;
  /** Their preview URL (e.g. `https://acme.webnua.dev`) — the email reminds
   *  them they have a real working site already, just gated. */
  previewUrl: string;
};

export type ReEngagementEmailOutcome = 'sent' | 'failed' | 'skipped';

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: ReEngagementEmailInput): string {
  const safeName = escape(input.businessName);
  const safeDash = escape(input.dashboardUrl);
  const safePreview = escape(input.previewUrl);
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Still here?</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">${safeName} is one click from live.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Your site is built. It just isn&rsquo;t public yet. Publish to go live, and Webnua starts driving real leads to your inbox.</p>
    <p style="margin:0 0 22px 0;">
      <a href="${safeDash}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Open dashboard + publish →</a>
    </p>
    <p style="font-size:13px;line-height:1.55;color:#4a4a45;margin:0 0 14px 0;"><strong>Why publish:</strong></p>
    <ul style="font-size:13px;line-height:1.6;color:#4a4a45;margin:0 0 22px 18px;padding:0;">
      <li>Your preview URL becomes a real, indexable URL</li>
      <li>Lead-capture forms start capturing real leads (not throttled)</li>
      <li>Your operator launches your first Meta ad campaign</li>
    </ul>
    <p style="font-size:13px;line-height:1.55;color:#4a4a45;margin:0 0 14px 0;">Want to see what you&rsquo;ve built first?</p>
    <p style="margin:0 0 22px 0;">
      <a href="${safePreview}" style="display:inline-block;border:1px solid #c9c0b0;background:#ffffff;color:#0a0a0a;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;">View your preview →</a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0;">Reply to this email if anything is in the way — we&rsquo;re here to help.</p>
  </div>
  <div style="text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;margin-top:18px;">&copy; Webnua &middot; Perth</div>
</body></html>`;
}

function buildText(input: ReEngagementEmailInput): string {
  return [
    `${input.businessName} is one click from live.`,
    '',
    "Your site is built. It just isn't public yet. Publish to go live, and Webnua starts driving real leads to your inbox.",
    '',
    `Open dashboard + publish: ${input.dashboardUrl}`,
    '',
    'Why publish:',
    '  - Your preview URL becomes a real, indexable URL',
    '  - Lead-capture forms start capturing real leads (not throttled)',
    '  - Your operator launches your first Meta ad campaign',
    '',
    `View your preview: ${input.previewUrl}`,
    '',
    "Reply to this email if anything is in the way — we're here to help.",
    '',
    '— Webnua',
  ].join('\n');
}

/** Send the 7-day re-engagement nudge. Never throws; failure surfaces
 *  through the return value so the job handler can decide retry / skip. */
export async function sendReEngagementEmail(
  input: ReEngagementEmailInput,
): Promise<ReEngagementEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[re-engagement-email] RESEND_API_KEY unset — skipped for ${input.recipientEmail}`,
    );
    return 'skipped';
  }

  const from = `Webnua <welcome@${env.EMAIL_SENDING_DOMAIN}>`;
  const result = await callExternal<{ id?: string }>({
    provider: 'resend',
    operation: 'send_re_engagement_email',
    url: 'https://api.resend.com/emails',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from,
      to: input.recipientEmail,
      subject: `${input.businessName} is one click from live`,
      html: buildHtml(input),
      text: buildText(input),
    },
    clientId: null,
  });

  if (!result.ok) {
    console.warn(
      `[re-engagement-email] Resend send failed for ${input.recipientEmail}: ${result.error.message}`,
    );
    return 'failed';
  }
  return 'sent';
}
