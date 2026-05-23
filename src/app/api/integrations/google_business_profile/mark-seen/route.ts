// =============================================================================
// /api/integrations/google_business_profile/mark-seen
//
// Clears the is_new_since_last_view flag on every unseen review for a
// client. The operator dashboard widget POSTs here when the reviews list
// is opened so the "N new" badge clears.
//
//   POST { clientId }
//
// Operator-only; client-role users see their own reviews but the "new"
// badge is for the operator team's triage.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { markReviewsSeen } from '@/lib/integrations/gbp/reviews';

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await markReviewsSeen(clientId);
  } catch (error) {
    return NextResponse.json(
      { error: 'mark-seen-failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
