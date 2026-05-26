// =============================================================================
// Invite email — sends the magic-link email for both team and client-user
// invites. Sibling of `lib/auth/verification-email.ts` (Pattern B signup);
// uses the same Resend platform-send shape via `callExternal`. Never throws
// — failure surfaces through the return value so the route handler can ack
// the row creation while reporting the email outcome.
//
// Two variants discriminated by `kind`:
//
//   kind: 'team'   — operator invites a Webnua team member. The recipient
//                    will land on /dashboard after accepting; the email
//                    frames the workspace ("Webnua") and the role
//                    they were granted.
//
//   kind: 'client' — invite into a client workspace. Used for the operator-
//                    concierge case (operator inviting the FIRST client
//                    owner of a freshly-created workspace) AND the client's
//                    own teammate invite. The recipient lands on /dashboard
//                    scoped to that client. The framing includes which
//                    business they were invited to.
//
// Tone — direct + concrete + Suby/Sultanic ("Hey {firstName}, {inviterName}
// invited you to {businessName}"). Same anchor as Pattern B's signup +
// welcome emails so the platform reads as one voice across all auth touches.
//
// SERVER-ONLY.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal } from '@/lib/integrations/_shared/call';
import { EMAIL_BRAND_FOOTER } from '@/lib/email/footer';

export type InviteEmailKind = 'team' | 'client';

export type InviteEmailInput = {
  kind: InviteEmailKind;
  /** The invitee's email address. */
  recipientEmail: string;
  /** The invitee's full name when known — used to personalise the greeting.
   *  Falls back to the local-part of their email if blank. */
  recipientName?: string | null;
  /** The display name of the operator/client who sent the invite. */
  inviterName: string;
  /** Workspace / business they're being invited into. For `team` invites
   *  this is the agency name ("Webnua"); for `client` invites this
   *  is the client business name. */
  workspaceName: string;
  /** The team role for `team` invites (Owner / Operator / Junior operator).
   *  Ignored for `client` invites. */
  roleLabel?: string | null;
  /** The full magic link URL the recipient clicks. */
  magicLink: string;
  /** ISO timestamp of expiry. The body shows a "good for N days" line. */
  expiresAt: string;
  /** Optional personal note the inviter typed. Rendered inline as a quote
   *  block when present. */
  personalNote?: string | null;
};

export type InviteEmailOutcome = 'sent' | 'failed' | 'skipped';

// --- formatting helpers ------------------------------------------------------

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name: string | null | undefined, email: string): string {
  const trimmed = (name ?? '').trim();
  if (trimmed) return trimmed.split(/\s+/)[0];
  const local = email.split('@')[0] ?? '';
  return local || 'there';
}

function daysUntil(isoExpires: string, now: Date = new Date()): number {
  const ms = new Date(isoExpires).getTime() - now.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// --- subject + body builders ------------------------------------------------

function buildSubject(input: InviteEmailInput): string {
  if (input.kind === 'team') {
    return `${input.inviterName} invited you to ${input.workspaceName} on Webnua`;
  }
  return `${input.inviterName} invited you to ${input.workspaceName} on Webnua`;
}

function buildHtml(input: InviteEmailInput): string {
  const safeFirst = escape(firstName(input.recipientName, input.recipientEmail));
  const safeInviter = escape(input.inviterName);
  const safeWorkspace = escape(input.workspaceName);
  const safeLink = escape(input.magicLink);
  const safeRole = input.kind === 'team' && input.roleLabel ? escape(input.roleLabel) : null;
  const safeNote = input.personalNote?.trim() ? escape(input.personalNote.trim()) : null;
  const days = daysUntil(input.expiresAt);
  const expiryLine = days <= 0
    ? 'This link expires soon.'
    : `This link is good for the next ${days} day${days === 1 ? '' : 's'}.`;

  const intro =
    input.kind === 'team'
      ? `<strong>${safeInviter}</strong> invited you to join <strong>${safeWorkspace}</strong> on Webnua${safeRole ? ` as ${safeRole}` : ''}.`
      : `<strong>${safeInviter}</strong> invited you to <strong>${safeWorkspace}</strong> on Webnua.`;

  const noteBlock = safeNote
    ? `<div style="background:#f5f1ea;border-left:3px solid #d24317;padding:12px 16px;margin:0 0 22px 0;border-radius:6px;">
         <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:6px;">// Note from ${safeInviter}</div>
         <p style="font-size:13px;line-height:1.55;color:#2a2a28;margin:0;font-style:italic;">${safeNote.replace(/\n/g, '<br/>')}</p>
       </div>`
    : '';

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;background:#f5f1ea;margin:0;padding:32px 16px;color:#0a0a0a;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px 28px;border:1px solid #c9c0b0;">
    <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#d24317;font-weight:700;margin-bottom:14px;">// You've been invited</div>
    <h1 style="font-size:24px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;margin:0 0 14px 0;">Hey ${safeFirst},</h1>
    <p style="font-size:14px;line-height:1.55;color:#2a2a28;margin:0 0 18px 0;">${intro}</p>
    ${noteBlock}
    <p style="font-size:14px;line-height:1.55;color:#4a4a45;margin:0 0 22px 0;">Click below to set your password and get started. ${expiryLine}</p>
    <p style="margin:0 0 22px 0;">
      <a href="${safeLink}" style="display:inline-block;background:#d24317;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">Set your password →</a>
    </p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0 0 6px 0;">Or copy this URL into your browser:</p>
    <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;line-height:1.45;color:#4a4a45;word-break:break-all;background:#f5f1ea;border:1px solid #c9c0b0;border-radius:6px;padding:10px 12px;margin:0 0 22px 0;">${safeLink}</p>
    <p style="font-size:12px;line-height:1.5;color:#6e685c;margin:0;">Didn&rsquo;t expect this? Ignore the email — the invite expires on its own and no account is created until you accept.</p>
  </div>
  ${EMAIL_BRAND_FOOTER}
</body></html>`;
}

function buildText(input: InviteEmailInput): string {
  const first = firstName(input.recipientName, input.recipientEmail);
  const role = input.kind === 'team' && input.roleLabel ? ` as ${input.roleLabel}` : '';
  const days = daysUntil(input.expiresAt);
  const expiryLine = days <= 0
    ? 'This link expires soon.'
    : `This link is good for the next ${days} day${days === 1 ? '' : 's'}.`;
  const intro =
    input.kind === 'team'
      ? `${input.inviterName} invited you to join ${input.workspaceName} on Webnua${role}.`
      : `${input.inviterName} invited you to ${input.workspaceName} on Webnua.`;

  const lines: string[] = [
    `Hey ${first},`,
    '',
    intro,
  ];
  if (input.personalNote?.trim()) {
    lines.push('', `Note from ${input.inviterName}:`, `  ${input.personalNote.trim().split('\n').join('\n  ')}`);
  }
  lines.push(
    '',
    `Click below to set your password and get started. ${expiryLine}`,
    '',
    input.magicLink,
    '',
    "Didn't expect this? Ignore the email — the invite expires on its own and no account is created until you accept.",
    '',
    '— Webnua',
  );
  return lines.join('\n');
}

// --- send -------------------------------------------------------------------

export async function sendInviteEmail(input: InviteEmailInput): Promise<InviteEmailOutcome> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[invite-email] RESEND_API_KEY unset — invite email skipped for ${input.recipientEmail}`,
    );
    return 'skipped';
  }

  const from = `Webnua <welcome@${env.EMAIL_SENDING_DOMAIN}>`;
  const result = await callExternal<{ id?: string }>({
    provider: 'resend',
    operation: input.kind === 'team' ? 'send_team_invite_email' : 'send_client_invite_email',
    url: 'https://api.resend.com/emails',
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: {
      from,
      to: input.recipientEmail,
      subject: buildSubject(input),
      html: buildHtml(input),
      text: buildText(input),
    },
    clientId: null,
  });

  if (!result.ok) {
    console.warn(
      `[invite-email] Resend send failed for ${input.recipientEmail}: ${result.error.message}`,
    );
    return 'failed';
  }
  return 'sent';
}
