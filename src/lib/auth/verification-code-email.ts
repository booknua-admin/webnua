// =============================================================================
// Verification-code email — conversational-onboarding (Session B).
//
// Sister of `verification-email.ts` (which sends the magic-link entry email
// for the legacy wizard sign-up). The conversational flow uses 6-digit
// codes instead — the code is the entire payload of this email; there is
// NO link. The user types the code back into the chat.
//
// Why a separate helper rather than re-using verification-email.ts:
//   - The payload + UX is different (a prominent code, not a CTA button).
//   - The legacy email stays valid for /sign-up/legacy + password reset
//     during the 30-day keep-alive; their lifecycles are independent.
//   - When the legacy path is sunset (V1.1), this is the only entry email
//     and verification-email.ts collapses to the password-reset path.
//
// 30-second timeout wrapper. On timeout the route falls back to magic-link
// (the existing `sendVerificationEmail`) with a visible UX message — see
// the parked "30s Resend failure → silent fallback to magic link" decision.
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';
import { EMAIL_BRAND_FOOTER } from '@/lib/email/footer';

export type VerificationCodeEmailInput = {
  recipientEmail: string;
  /** The 6-digit code. Sent in plain text; the DB stores only the hash. */
  code: string;
  /** Display-friendly expiry, e.g. 10. */
  expiresInMinutes: number;
};

export type VerificationCodeEmailOutcome = 'sent' | 'failed' | 'skipped' | 'timeout';

/** Wraps a promise with a hard timeout. Resolves to a discriminated result
 *  so the caller can distinguish "timed out" from "send threw" and "send
 *  returned a failure". */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<{ kind: 'ok'; value: T } | { kind: 'timeout' }> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<{ kind: 'timeout' }>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), ms);
  });
  try {
    const result = await Promise.race([
      promise.then((value) => ({ kind: 'ok' as const, value })),
      timeout,
    ]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(input: VerificationCodeEmailInput): string {
  const safeCode = escape(input.code);
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 0;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// Your verification code</div>
    <h1 style="font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">Type this code back into the chat.</h1>
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Your 6-digit verification code is below. It expires in ${input.expiresInMinutes} minutes.</p>
    <div style="text-align:center;background:#f5f1ea;border:1px solid #c9c0b0;border-radius:10px;padding:22px 12px;margin:0 0 22px 0;">
      <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:36px;line-height:1;font-weight:700;letter-spacing:0.32em;color:#0a0a0a;">${safeCode}</div>
    </div>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0 0 6px 0;">Didn&rsquo;t request this code? You can safely ignore this email — your account stays unverified.</p>
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

function buildText(input: VerificationCodeEmailInput): string {
  return [
    `Your Webnua verification code: ${input.code}`,
    '',
    `Type the code back into the chat. It expires in ${input.expiresInMinutes} minutes.`,
    '',
    "Didn't request this code? You can safely ignore this email.",
    '',
    '— Webnua',
  ].join('\n');
}

const SEND_TIMEOUT_MS = 30_000;

/**
 * Send the 6-digit code email. Returns:
 *   - 'sent'    — Resend accepted the message.
 *   - 'failed'  — Resend returned an error.
 *   - 'skipped' — RESEND_API_KEY is unset (dev mode).
 *   - 'timeout' — the call did not resolve within 30s; caller should fall
 *                 back to magic-link.
 */
export async function sendVerificationCodeEmail(
  input: VerificationCodeEmailInput,
): Promise<VerificationCodeEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[verification-code-email] RESEND_API_KEY unset — code email skipped for ${input.recipientEmail}`,
    );
    return 'skipped';
  }

  const from = `Webnua <welcome@${env.EMAIL_SENDING_DOMAIN}>`;
  const send = callExternal<{ id?: string }>({
    provider: 'resend',
    operation: 'send_verification_code_email',
    url: 'https://api.resend.com/emails',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from,
      to: input.recipientEmail,
      subject: `Your Webnua verification code: ${input.code}`,
      html: buildHtml(input),
      text: buildText(input),
    },
    clientId: null,
  });

  const raced = await withTimeout(send, SEND_TIMEOUT_MS);
  if (raced.kind === 'timeout') {
    console.warn(
      `[verification-code-email] Resend timeout (>${SEND_TIMEOUT_MS}ms) for ${input.recipientEmail}`,
    );
    return 'timeout';
  }
  if (!raced.value.ok) {
    console.warn(
      `[verification-code-email] Resend send failed for ${input.recipientEmail}: ${raced.value.error.message}`,
    );
    return 'failed';
  }
  return 'sent';
}
