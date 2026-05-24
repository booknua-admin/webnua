// =============================================================================
// POST /api/invites/client — invite a user into a CLIENT workspace.
//
// Two callers:
//   - A client owner inviting a teammate into their own workspace.
//   - An operator inviting the FIRST client owner of a freshly-created
//     workspace (the concierge path).
//
// Auth: `requireOperatorOrClient(request, clientId)` — operator with
// accessible-client scope OR the client-role user whose `client_id` matches.
// =============================================================================

import { NextResponse } from 'next/server';

import { isAppError, normalizeError } from '@/lib/errors';
import { createClientUserInvite } from '@/lib/invites/server';

import { requireOperatorOrClient } from '../_auth';

type Body = {
  email?: unknown;
  fullName?: unknown;
  clientId?: unknown;
  personalNote?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const fullName = typeof body.fullName === 'string' ? body.fullName : '';
  const clientId = typeof body.clientId === 'string' ? body.clientId : '';
  const personalNote = typeof body.personalNote === 'string' ? body.personalNote : '';

  if (!clientId) {
    return NextResponse.json({ error: 'client-required' }, { status: 400 });
  }

  const auth = await requireOperatorOrClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await createClientUserInvite({
      email,
      fullName,
      clientId,
      personalNote,
      invitedBy: auth.userId,
      isOperator: auth.isOperator,
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
