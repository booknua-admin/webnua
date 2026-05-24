// =============================================================================
// Cancellation 7-day-warning email — Pattern B two-stage cancellation,
// stage 2 (day 83 of the cancellation lifecycle, 7 days before hard delete).
//
// Sister of `lib/auth/re-engagement-email.ts` + `welcome-email.ts` —
// minimal inline Resend send via `callExternal`. Degrades to 'skipped' when
// the API key is unset (a dev deploy never blocks; the handler still
// stamps `hard_delete_warning_sent_at` to prevent the cron from re-
// enqueueing on every tick).
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';

export type CancellationWarningEmailInput = {
  recipientEmail: string;
  businessName: string;
  /** Number of days until hard delete (typically 7 — set by the day-83 cron). */
  daysRemaining: number;
  /** A support contact route — operator-facing for the recovery request. */
  supportUrl: string;
};

export type CancellationWarningEmailOutcome = 'sent' | 'failed' | 'skipped';

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: CancellationWarningEmailInput): string {
  const name = escape(input.businessName);
  const support = escape(input.supportUrl);
  const days = input.daysRemaining;
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#c44444;font-weight:700;margin-bottom:14px;">// Final notice</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">${name} will be permanently deleted in ${days} ${days === 1 ? 'day' : 'days'}.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Your account was cancelled 30 days ago and your data has been retained for an additional 60-day operator-recovery window. That window closes in <strong>${days} ${days === 1 ? 'day' : 'days'}</strong>.</p>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;"><strong>If you&rsquo;d like to restore your account</strong>, reply to this email or contact Webnua support before then. We can re-enable your workspace exactly as it was — your site, your leads, your bookings, your reviews.</p>
    <p style="margin:0 0 22px 0;">
      <a href="${support}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Contact support →</a>
    </p>
    <p style="font-size:13px;line-height:1.55;color:#4a4a45;margin:0 0 14px 0;"><strong>What happens if you do nothing:</strong></p>
    <ul style="font-size:13px;line-height:1.6;color:#4a4a45;margin:0 0 22px 18px;padding:0;">
      <li>Your account + all associated data (site, leads, bookings, reviews, automations) will be permanently deleted</li>
      <li>The deletion is irreversible — even support cannot recover it after this date</li>
      <li>Your sign-in will stop working</li>
    </ul>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0;">This is the only notice you&rsquo;ll receive. If you&rsquo;re sure you don&rsquo;t need your data, you can ignore this email.</p>
  </div>
  <div style="text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;margin-top:18px;">&copy; Webnua &middot; Perth</div>
</body></html>`;
}

function buildText(input: CancellationWarningEmailInput): string {
  const days = input.daysRemaining;
  return [
    `${input.businessName} will be permanently deleted in ${days} ${days === 1 ? 'day' : 'days'}.`,
    '',
    'Your account was cancelled 30 days ago and your data has been retained for an additional 60-day operator-recovery window. That window closes in ' +
      `${days} ${days === 1 ? 'day' : 'days'}.`,
    '',
    "If you'd like to restore your account, reply to this email or contact Webnua support before then. We can re-enable your workspace exactly as it was — your site, your leads, your bookings, your reviews.",
    '',
    `Contact support: ${input.supportUrl}`,
    '',
    'What happens if you do nothing:',
    '  - Your account + all associated data will be permanently deleted',
    '  - The deletion is irreversible',
    '  - Your sign-in will stop working',
    '',
    "This is the only notice you'll receive. If you're sure you don't need your data, you can ignore this email.",
    '',
    '© Webnua · Perth',
  ].join('\n');
}

export async function sendCancellationWarningEmail(
  input: CancellationWarningEmailInput,
): Promise<CancellationWarningEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[cancellation-warning] RESEND_API_KEY unset; skipping email to ${input.recipientEmail}`,
    );
    return 'skipped';
  }

  const fromAddress = `Webnua <support@${env.EMAIL_SENDING_DOMAIN}>`;

  const result = await callExternal<{ id?: string }>({
    provider: 'resend',
    operation: 'send_cancellation_warning_email',
    method: 'POST',
    url: 'https://api.resend.com/emails',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from: fromAddress,
      to: input.recipientEmail,
      subject: `Final notice — ${input.businessName} will be deleted in ${input.daysRemaining} ${
        input.daysRemaining === 1 ? 'day' : 'days'
      }`,
      html: buildHtml(input),
      text: buildText(input),
    },
  });

  if (!result.ok) {
    console.warn('[cancellation-warning] send failed', result.error);
    return 'failed';
  }
  return 'sent';
}
