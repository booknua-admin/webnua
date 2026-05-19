// =============================================================================
// Email templates — pure HTML/text rendering for transactional email.
//
// No server-only imports (no Resend SDK, no env): this module is pure string
// construction, so the InviteEmailPayload type can be imported by client code
// (the send-invite-email helper) without pulling server code into the bundle.
//
// Every interpolated value is HTML-escaped — the payload carries user-authored
// strings (names, personal notes, the magic link), and an invite email is
// addressed to a not-yet-trusted recipient. Escaping closes the injection hole.
// =============================================================================

export type InviteEmailKind = 'team' | 'client';

export type InviteEmailPayload = {
  kind: InviteEmailKind;
  /** Recipient email address. */
  to: string;
  /** Invitee's name — may be empty (the form leaves it optional). */
  recipientName: string;
  /** Display name of the person who sent the invite. */
  inviterName: string;
  /** The workspace/business they're being invited into. */
  workspaceName: string;
  /** Team role name — present for `kind: 'team'` only. */
  roleName?: string;
  /** The accept/onboarding magic link. */
  magicLink: string;
  /** Optional personal note from the inviter — may be empty. */
  personalNote: string;
  /** ISO 8601 invite expiry. */
  expiresAt: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

// --- Webnua palette (the design tokens, inlined — email clients need it) -----
const PAPER = '#f5f1ea';
const INK = '#0a0a0a';
const INK_QUIET = '#6e685c';
const RUST = '#d24317';
const RULE = '#c9c0b0';
const CARD = '#ffffff';

/** HTML-escape a string for safe interpolation into element content or a
 *  double-quoted attribute. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'soon';
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Render the invite email — branded HTML + a plain-text alternative. */
export function renderInviteEmail(payload: InviteEmailPayload): RenderedEmail {
  const firstName = payload.recipientName.trim().split(' ')[0] || 'there';
  const expiry = formatExpiry(payload.expiresAt);

  const subject =
    payload.kind === 'team'
      ? `${payload.inviterName} invited you to join ${payload.workspaceName} on Webnua`
      : `${payload.inviterName} invited you to ${payload.workspaceName} on Webnua`;

  const intro =
    payload.kind === 'team'
      ? `${payload.inviterName} has invited you to join ${payload.workspaceName} on Webnua` +
        (payload.roleName ? ` as ${withArticle(payload.roleName)}` : '') +
        '.'
      : `${payload.inviterName} has invited you to join the ${payload.workspaceName} ` +
        'account on Webnua.';

  const accessLine =
    payload.kind === 'team'
      ? 'Click the button below to set your password and get into the workspace.'
      : 'Click the button below to set your password and join the account. ' +
        "You'll start with view-only access — your operator grants editing where it's needed.";

  // --- text alternative ------------------------------------------------------
  const text = [
    `Hi ${firstName},`,
    '',
    intro,
    '',
    accessLine,
    '',
    `Accept the invite: ${payload.magicLink}`,
    '',
    payload.personalNote.trim()
      ? [`A note from ${payload.inviterName}:`, `"${payload.personalNote.trim()}"`, ''].join('\n')
      : '',
    `This invite expires on ${expiry}.`,
    '',
    '— The Webnua team',
  ]
    .filter((line) => line !== null)
    .join('\n');

  // --- HTML ------------------------------------------------------------------
  const eFirst = escapeHtml(firstName);
  const eIntro = escapeHtml(intro);
  const eAccess = escapeHtml(accessLine);
  const eLink = escapeHtml(payload.magicLink);
  const eExpiry = escapeHtml(expiry);
  const eInviter = escapeHtml(payload.inviterName);
  const note = payload.personalNote.trim();

  const noteBlock = note
    ? `
            <tr>
              <td style="padding: 0 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-left: 3px solid ${RUST}; background: ${PAPER}; padding: 14px 18px; border-radius: 4px;">
                      <div style="font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: ${INK_QUIET}; margin-bottom: 6px;">
                        A note from ${eInviter}
                      </div>
                      <div style="font-size: 14px; line-height: 1.6; color: ${INK}; font-style: italic;">
                        ${escapeHtml(note)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${PAPER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${PAPER};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%;">
          <tr>
            <td style="padding: 0 0 24px;">
              <span style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 800; letter-spacing: -0.03em; color: ${INK};">
                Webnua <span style="color: ${RUST};">&#9670;</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="background: ${CARD}; border: 1px solid ${RULE}; border-radius: 14px; padding: 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <tr>
                  <td style="font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: ${INK}; padding: 0 0 16px;">
                    Hi ${eFirst}, you're invited
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 15px; line-height: 1.6; color: ${INK}; padding: 0 0 16px;">
                    ${eIntro}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 15px; line-height: 1.6; color: ${INK_QUIET}; padding: 0 0 24px;">
                    ${eAccess}
                  </td>
                </tr>
                ${noteBlock}
                <tr>
                  <td style="padding: 0 0 24px;">
                    <a href="${eLink}" style="display: inline-block; background: ${RUST}; color: ${PAPER}; font-size: 15px; font-weight: 700; text-decoration: none; padding: 13px 28px; border-radius: 8px;">
                      Accept invite &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; line-height: 1.6; color: ${INK_QUIET}; padding: 0 0 8px;">
                    This invite expires on <strong style="color: ${INK};">${eExpiry}</strong>.
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; line-height: 1.6; color: ${INK_QUIET};">
                    If the button doesn't work, copy this link into your browser:<br />
                    <span style="color: ${RUST}; word-break: break-all;">${eLink}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 4px 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: ${INK_QUIET};">
              You received this because ${eInviter} invited you to Webnua. If you weren't expecting this, you can safely ignore it.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/** "operator" -> "an operator"; "junior operator" -> "a junior operator". */
function withArticle(noun: string): string {
  const article = /^[aeiou]/i.test(noun.trim()) ? 'an' : 'a';
  return `${article} ${noun}`;
}
