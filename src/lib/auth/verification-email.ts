// =============================================================================
// Verification email — the entry email for Pattern B's self-serve signup.
//
// Fires from /api/sign-up after the clients row + auth.users row are written
// (both in 'pending_verification' / unconfirmed). The recipient clicks the
// magic link → Supabase confirms the email → the migration 0085 trigger
// transitions clients.lifecycle_status to 'preview' → the user lands on
// /dashboard which renders the wizard.
//
// Sister of `lib/auth/welcome-email.ts` (which now fires AFTER publish — the
// payment confirmation moment, not signup). Both use the same Resend
// platform send pattern (`callExternal`, 'skipped' when key unset, never
// throws).
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';
import { EMAIL_BRAND_FOOTER } from '@/lib/email/footer';

export type VerificationEmailInput = {
  recipientEmail: string;
  businessName: string;
  /** The magic-link URL from `supabase.auth.admin.generateLink({ type:
   *  'magiclink' })`. Clicking it confirms the email + signs the user in. */
  magicLink: string;
};

export type VerificationEmailOutcome = 'sent' | 'failed' | 'skipped';

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: VerificationEmailInput): string {
  const safeName = escape(input.businessName);
  const safeLink = escape(input.magicLink);
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Confirm your email</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">Welcome to Webnua, ${safeName}.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Click the button below to confirm your email and start building. Free until you publish — no payment needed to see what your site looks like. The link is good for the next hour.</p>
    <p style="margin:0 0 22px 0;">
      <a href="${safeLink}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Confirm + start building →</a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0 0 6px 0;">Or copy this URL into your browser:</p>
    <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.45;color:#4a4a45;word-break:break-all;background:#f5f1ea;border:1px solid #c9c0b0;border-radius:6px;padding:10px 12px;margin:0 0 22px 0;">${safeLink}</p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0;">Didn&rsquo;t sign up? Ignore this email — your workspace stays unverified and is auto-cleaned in 7 days.</p>
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

function buildText(input: VerificationEmailInput): string {
  return [
    `Welcome to Webnua, ${input.businessName}.`,
    '',
    "Confirm your email and start building. Free until you publish — no payment needed to see what your site looks like. The link is good for the next hour:",
    '',
    input.magicLink,
    '',
    "Didn't sign up? Ignore this email — your workspace stays unverified and is auto-cleaned in 7 days.",
    '',
    '— Webnua',
  ].join('\n');
}

/** Send the verification + magic-link email. Never throws — failure
 *  surfaces through the return value so /api/sign-up can decide whether
 *  to expose the signup as "we sent the email" or to surface the failure. */
export async function sendVerificationEmail(
  input: VerificationEmailInput,
): Promise<VerificationEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[verification-email] RESEND_API_KEY unset — verification email skipped for ${input.recipientEmail}`,
    );
    return 'skipped';
  }

  const from = `Webnua <welcome@${env.EMAIL_SENDING_DOMAIN}>`;
  const result = await callExternal<{ id?: string }>({
    provider: 'resend',
    operation: 'send_verification_email',
    url: 'https://api.resend.com/emails',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from,
      to: input.recipientEmail,
      subject: `Confirm your email to start building`,
      html: buildHtml(input),
      text: buildText(input),
    },
    clientId: null,
  });

  if (!result.ok) {
    console.warn(
      `[verification-email] Resend send failed for ${input.recipientEmail}: ${result.error.message}`,
    );
    return 'failed';
  }
  return 'sent';
}
