// =============================================================================
// POST /api/clients/[id]/refuse-signup
//
// The conversational onboarding extract step classifies the customer's
// business as a restaurant or an ecommerce store — both outside Webnua's
// "service businesses that need leads" scope. The shell mounts a friendly
// refuse screen pointing the customer at hello@webnua.com for a manual
// build, AND POSTs here to flip the workspace's lifecycle_status to 'banned'
// so the row no longer counts as a seat + the customer's bearer token
// stops resolving them into a usable dashboard.
//
// Audit: we persist `clients.conversation_state.capturedFacts.refusedReason`
// + `refusedAt` from the shell (already part of the conversation_state
// route's `capturedFacts: Record<string, unknown>` payload, no schema
// change needed); the operator dashboard's existing `LIFECYCLE_LABEL.banned`
// surfaces them on /signups under the Banned filter. Hard-delete is NOT
// part of refusal — the Pattern B "soft → 30-day grace → hard delete"
// lifecycle is for paid cancellations; a refusal is a terminal "wrong fit"
// state and stays banned indefinitely (operator can pursue manual outreach
// off-platform). The auth user stays signed up too — cheap, harmless,
// and a future "we built a tool for restaurants" message could re-engage.
//
// Auth: requireClientAccess — the customer for their own client (the
// extract step has already provisioned + verified the workspace, so the
// session resolves cleanly). Operators may also call it for the concierge
// edge case where they're walking a customer through and realise mid-call
// that the business isn't supported.
//
// Idempotency: re-POSTing for an already-banned workspace is a no-op.
// Refuses to ban a workspace already in a terminal state (deleted /
// churned) to avoid masking pre-existing state.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getServiceClient } from '@/lib/supabase/server';

type RefuseReason = 'restaurant' | 'ecom';

const REFUSE_REASONS: readonly RefuseReason[] = ['restaurant', 'ecom'];

type Body = {
  refuseReason?: unknown;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await context.params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const reasonRaw =
    typeof body.refuseReason === 'string' ? body.refuseReason.trim().toLowerCase() : '';
  if (!(REFUSE_REASONS as readonly string[]).includes(reasonRaw)) {
    return NextResponse.json({ error: 'invalid-refuse-reason' }, { status: 400 });
  }
  const refuseReason = reasonRaw as RefuseReason;

  const svc = getServiceClient();

  // Read current lifecycle to refuse banning an already-terminal workspace.
  // A row in 'deleted' / 'churned' is structurally fine to ban over (no
  // active subscription), but doing so masks the previous state with no
  // win — better to short-circuit and let the operator inspect the row.
  const { data: current, error: readError } = await svc
    .from('clients')
    .select('lifecycle_status, conversation_state')
    .eq('id', clientId)
    .maybeSingle();
  if (readError || !current) {
    return NextResponse.json({ error: 'client-not-found' }, { status: 404 });
  }
  const row = current as {
    lifecycle_status: string;
    conversation_state: Record<string, unknown> | null;
  };

  if (row.lifecycle_status === 'banned') {
    // Idempotent — the shell may retry on a transient network failure
    // after the actual ban succeeded.
    return NextResponse.json({ ok: true, changed: false });
  }
  if (row.lifecycle_status === 'deleted' || row.lifecycle_status === 'churned') {
    return NextResponse.json(
      { error: 'workspace-in-terminal-state', current: row.lifecycle_status },
      { status: 409 },
    );
  }

  // Merge the refusal facts into conversation_state.capturedFacts so the
  // shell's resume path can re-mount the RefuseScreen + the operator can
  // see WHY this workspace got banned without spelunking auth logs. The
  // route's existing jsonb shape accepts arbitrary keys on capturedFacts,
  // so this is purely additive.
  const baseState =
    (row.conversation_state as
      | {
          messages?: unknown;
          capturedFacts?: Record<string, unknown>;
          current_turn?: unknown;
          verified?: unknown;
        }
      | null) ?? {};
  const capturedFacts = {
    ...(typeof baseState.capturedFacts === 'object' && baseState.capturedFacts !== null
      ? baseState.capturedFacts
      : {}),
    refusedReason: refuseReason,
    refusedAt: new Date().toISOString(),
  };
  const nextState = {
    messages: Array.isArray(baseState.messages) ? baseState.messages : [],
    capturedFacts,
    current_turn:
      typeof baseState.current_turn === 'number' ? baseState.current_turn : 1,
    verified: baseState.verified === true,
  };

  const { error: updateError } = await svc
    .from('clients')
    .update({
      lifecycle_status: 'banned',
      conversation_state: nextState,
    } as never)
    .eq('id', clientId);
  if (updateError) {
    console.error('[refuse-signup] clients update failed:', updateError.message);
    return NextResponse.json(
      { error: 'update-failed', detail: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, changed: true, refuseReason });
}
