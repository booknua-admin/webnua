// =============================================================================
// Welcome email — send the magic-link to a freshly-paid signup.
//
// Sister of `lib/integrations/stripe/notify.ts` — a MINIMAL inline Resend send
// for one transactional message (the post-payment welcome). The full Resend
// integration (per-client sender slugs, templates, threading, delivery
// webhook reconciliation) is irrelevant here: a brand-new signup has no
// client_email_senders row yet, so we send from a platform-level sender on
// the agency's own EMAIL_SENDING_DOMAIN.
//
// Routes the call through callExternal() so it gets the same timeout / retry
// / integration_call_log treatment as every other outbound integration call.
// Degrades to 'skipped' when RESEND_API_KEY is unset — the magic link still
// exists in Supabase, the operator can resend manually or hand the link to
// the customer over another channel. Never throws — a send failure is a
// reported outcome, so the signup webhook can ack 200 to Stripe regardless.
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';

export type WelcomeEmailInput = {
  recipientEmail: string;
  businessName: string;
  /** The magic-link URL produced by `supabase.auth.admin.generateLink`. */
  magicLink: string;
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
  const safeLink = escape(input.magicLink);
  // Plain, table-free HTML — the welcome email is a single CTA, not a
  // full marketing template. Major mail clients render this fine.
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Welcome to Webnua</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">${safeName} is live.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Your subscription is active. Click the button below to sign in to your new workspace — no password needed. The link is good for the next hour.</p>
    <p style="margin:0 0 22px 0;">
      <a href="${safeLink}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Sign in to Webnua →</a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0 0 6px 0;">Or copy this URL into your browser:</p>
    <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.45;color:#4a4a45;word-break:break-all;background:#f5f1ea;border:1px solid #c9c0b0;border-radius:6px;padding:10px 12px;margin:0 0 22px 0;">${safeLink}</p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0;">Didn&rsquo;t sign up? Ignore this email and nothing happens — the workspace stays unclaimed and we&rsquo;ll auto-clean it.</p>
  </div>
  <div style="text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6e685c;margin-top:18px;">&copy; Webnua &middot; Perth</div>
</body></html>`;
}

function buildText(input: WelcomeEmailInput): string {
  return [
    `Welcome to Webnua — ${input.businessName} is live.`,
    '',
    'Your subscription is active. Use this link to sign in to your new workspace (no password needed; the link is good for the next hour):',
    '',
    input.magicLink,
    '',
    "Didn't sign up? Ignore this email and nothing happens — the workspace stays unclaimed and we'll auto-clean it.",
    '',
    '— Webnua',
  ].join('\n');
}

/** Send the welcome + magic-link email. Never throws — failure surfaces
 *  through the return value so the signup webhook can ack Stripe regardless. */
export async function sendWelcomeEmail(input: WelcomeEmailInput): Promise<WelcomeEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[welcome-email] RESEND_API_KEY unset — welcome email skipped for ${input.recipientEmail}`,
    );
    return 'skipped';
  }

  const from = `Webnua <welcome@${env.EMAIL_SENDING_DOMAIN}>`;
  const result = await callExternal<{ id?: string }>({
    provider: 'resend',
    operation: 'send_welcome_email',
    url: 'https://api.resend.com/emails',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from,
      to: input.recipientEmail,
      subject: `Welcome to Webnua — ${input.businessName} is live`,
      html: buildHtml(input),
      text: buildText(input),
    },
    // Tenant attribution N/A — no clients row exists at the moment of send.
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
