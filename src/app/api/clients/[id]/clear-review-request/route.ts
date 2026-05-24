// =============================================================================
// POST /api/clients/[id]/clear-review-request
//
// Operator-only endpoint to mark a review request handled — sets
// `clients.review_requested_at` back to NULL. Used by the operator dashboard
// "Mark handled" button. Idempotent — clearing an already-clear request
// returns success.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getIntegrationDb();
  const { error } = await db
    .from('clients')
    .update({ review_requested_at: null })
    .eq('id', clientId);
  if (error) {
    return NextResponse.json({ error: 'update-failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
