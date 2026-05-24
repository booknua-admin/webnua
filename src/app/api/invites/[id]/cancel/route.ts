// =============================================================================
// POST /api/invites/[id]/cancel — flip a pending invite to 'revoked'.
//
// Auth shape mirrors /resend — operator for team_invites, operator-or-client
// for client_user_invites. The actual revoke is a row UPDATE; we don't
// delete because the audit trail (who invited, when) matters.
// =============================================================================

import { NextResponse } from 'next/server';

import { isAppError, normalizeError } from '@/lib/errors';
import { cancelInvite } from '@/lib/invites/server';
import { getServiceClient } from '@/lib/supabase/server';

import { requireOperator, requireOperatorOrClient } from '../../_auth';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'invite-not-found' }, { status: 404 });

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
    await cancelInvite(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isAppError(error)) {
      const status = error.kind === 'not_found' ? 404 : 500;
      return NextResponse.json({ error: error.message, kind: error.kind }, { status });
    }
    const fallback = normalizeError(error);
    return NextResponse.json({ error: fallback.message }, { status: 500 });
  }
}
