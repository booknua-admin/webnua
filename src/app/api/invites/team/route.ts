// =============================================================================
// POST /api/invites/team — operator invites a Webnua team member.
//
// Operator-only. Inserts a `team_invites` row + the `team_invite_clients`
// join rows for junior assignments + sends the magic-link email via Resend.
// Returns the persisted invite (with real token + magic link) so the modal
// can render the confirmation step.
// =============================================================================

import { NextResponse } from 'next/server';

import { isAppError, normalizeError } from '@/lib/errors';
import { createTeamInvite } from '@/lib/invites/server';
import type { TeamRole } from '@/lib/team/roles';

import { requireOperator } from '../_auth';

type Body = {
  email?: unknown;
  fullName?: unknown;
  role?: unknown;
  assignedClientIds?: unknown;
  personalNote?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const auth = await requireOperator(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName : '';
  const role = typeof body.role === 'string' ? (body.role as TeamRole) : ('junior' as TeamRole);
  const assignedClientIds = Array.isArray(body.assignedClientIds)
    ? (body.assignedClientIds.filter((v) => typeof v === 'string') as string[])
    : [];
  const personalNote = typeof body.personalNote === 'string' ? body.personalNote : '';

  try {
    const result = await createTeamInvite({
      email,
      fullName,
      role,
      assignedClientIds,
      personalNote,
      invitedBy: auth.userId,
      requestOrigin: new URL(request.url).origin,
    });
    return NextResponse.json({ ok: true, invite: result.invite, emailOutcome: result.emailOutcome });
  } catch (error) {
    if (isAppError(error)) {
      const status = error.kind === 'validation' ? 400 : error.kind === 'conflict' ? 409 : 500;
      return NextResponse.json({ error: error.message, kind: error.kind }, { status });
    }
    const fallback = normalizeError(error);
    return NextResponse.json({ error: fallback.message }, { status: 500 });
  }
}
