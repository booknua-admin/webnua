// =============================================================================
// GET /api/invites/[token] — public (no auth) invite lookup.
//
// Resolves the opaque invite token to a redacted summary the accept page
// renders (workspace name, inviter name, expiry, optional personal note).
// Never exposes the invitee email, the invite id, or any other field that
// would let a curious party scrape pending invites — only what the page
// itself displays.
//
// Returns:
//   200  { ok: true, invite: { … } }   — invite is valid and acceptable.
//   410  { ok: false, reason: 'expired' | 'consumed' | 'revoked' }
//   404  { ok: false, reason: 'not_found' }
//
// 410 (Gone) is deliberate for the second and third — the resource existed
// but is no longer actionable. The accept page surfaces a friendly message
// + a "contact your operator" link.
// =============================================================================

import { NextResponse } from 'next/server';

import { resolveInviteByToken } from '@/lib/invites/server';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await context.params;
  if (!token) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 });
  }

  const result = await resolveInviteByToken(token);
  if (!result.ok) {
    const status = result.reason === 'not_found' ? 404 : 410;
    return NextResponse.json({ ok: false, reason: result.reason }, { status });
  }

  // Strip the email from the public response — the accept page already
  // knows the recipient (it's the one with the link), and we DON'T want to
  // confirm "yes, invitee@example.com really was invited" to anyone who
  // brute-forces tokens. The accept POST validates internally.
  if (result.kind === 'client') {
    return NextResponse.json({
      ok: true,
      invite: {
        kind: 'client',
        fullName: result.fullName,
        clientName: result.clientName,
        inviterName: result.inviterName,
        personalNote: result.personalNote,
        expiresAt: result.expiresAt,
      },
    });
  }
  return NextResponse.json({
    ok: true,
    invite: {
      kind: 'team',
      fullName: result.fullName,
      workspaceName: result.workspaceName,
      roleLabel: result.roleLabel,
      inviterName: result.inviterName,
      personalNote: result.personalNote,
      expiresAt: result.expiresAt,
    },
  });
}
