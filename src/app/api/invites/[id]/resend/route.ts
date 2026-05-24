// =============================================================================
// POST /api/invites/[id]/resend — re-mint token + extend expiry + re-send.
//
// Auth: the row must belong to a workspace the caller can manage. For team
// invites that means operator-only. For client_user_invites either an
// operator with access or the client owner. We resolve which kind the id
// is by probing both tables (cheap — two indexed lookups in parallel).
// =============================================================================

import { NextResponse } from 'next/server';

import { isAppError, normalizeError } from '@/lib/errors';
import { resendInvite } from '@/lib/invites/server';
import { getServiceClient } from '@/lib/supabase/server';

import { requireOperator, requireOperatorOrClient } from '../../_auth';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'invite-not-found' }, { status: 404 });

  // Probe both tables to discover the kind. We don't want to require
  // operator role for a route that might be revoking a client-user invite.
  const svc = getServiceClient();
  const [teamProbe, clientProbe] = await Promise.all([
    svc.from('team_invites').select('id').eq('id', id).maybeSingle(),
    svc.from('client_user_invites').select('id, client_id').eq('id', id).maybeSingle(),
  ]);

  let auth: Awaited<ReturnType<typeof requireOperator>>;
  if (teamProbe.data) {
    auth = await requireOperator(request);
  } else if (clientProbe.data) {
    const clientId = (clientProbe.data as { client_id: string }).client_id;
    auth = await requireOperatorOrClient(request, clientId);
  } else {
    return NextResponse.json({ error: 'invite-not-found' }, { status: 404 });
  }
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await resendInvite({
      id,
      callerUserId: auth.userId,
      callerIsOperator: auth.isOperator,
      requestOrigin: new URL(request.url).origin,
    });
    return NextResponse.json({ ok: true, invite: result.invite, emailOutcome: result.emailOutcome });
  } catch (error) {
    if (isAppError(error)) {
      const status =
        error.kind === 'not_found'
          ? 404
          : error.kind === 'forbidden'
            ? 403
            : error.kind === 'conflict'
              ? 409
              : 500;
      return NextResponse.json({ error: error.message, kind: error.kind }, { status });
    }
    const fallback = normalizeError(error);
    return NextResponse.json({ error: fallback.message }, { status: 500 });
  }
}
