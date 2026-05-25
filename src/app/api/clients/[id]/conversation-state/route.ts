// =============================================================================
// /api/clients/[id]/conversation-state — conversational onboarding (Session B).
//
// GET   → returns the client's current conversation_state jsonb.
// POST  → upserts the state. Body: { messages, capturedFacts, current_turn,
//         verified, lastSeenMessageId? }
//
// Auth: requireClientAccess — operator-on-an-accessible-client OR the
// client-role user for that client (the freshly-verified self-serve owner).
//
// Multi-tab race resolution: when the body carries `lastSeenMessageId`, the
// route compares it against the server's most-recent message id. If they
// don't match, the route returns 409 with the current state so the client
// can merge — last-write-wins per CLAUDE.md's "Pattern B chat resume" shape
// for the wizard. Conversational onboarding's surface is more interactive
// than the wizard's, so we add the conflict signal up front rather than
// retrofit it after the first tab-collision bug report.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getServiceClient } from '@/lib/supabase/server';

type ChatMessage = {
  id?: string;
  role?: string;
  content?: string;
  timestamp?: string;
};

type ConversationState = {
  messages: ChatMessage[];
  capturedFacts: Record<string, unknown>;
  current_turn: number;
  verified: boolean;
};

type Body = {
  messages?: unknown;
  capturedFacts?: unknown;
  current_turn?: unknown;
  verified?: unknown;
  lastSeenMessageId?: unknown;
};

const INITIAL_STATE: ConversationState = {
  messages: [],
  capturedFacts: {},
  current_turn: 1,
  verified: false,
};

function lastMessageId(state: ConversationState | null): string | null {
  if (!state || !Array.isArray(state.messages) || state.messages.length === 0) return null;
  const tail = state.messages[state.messages.length - 1];
  return typeof tail?.id === 'string' ? tail.id : null;
}

function validateState(body: Body): { ok: true; state: ConversationState } | { ok: false; error: string } {
  if (!Array.isArray(body.messages)) return { ok: false, error: 'messages-invalid' };
  if (typeof body.capturedFacts !== 'object' || body.capturedFacts === null || Array.isArray(body.capturedFacts)) {
    return { ok: false, error: 'captured-facts-invalid' };
  }
  if (typeof body.current_turn !== 'number' || !Number.isFinite(body.current_turn)) {
    return { ok: false, error: 'current-turn-invalid' };
  }
  if (typeof body.verified !== 'boolean') return { ok: false, error: 'verified-invalid' };
  return {
    ok: true,
    state: {
      messages: body.messages as ChatMessage[],
      capturedFacts: body.capturedFacts as Record<string, unknown>,
      current_turn: body.current_turn,
      verified: body.verified,
    },
  };
}

async function readState(clientId: string): Promise<ConversationState | null> {
  const svc = getServiceClient();
  const { data, error } = await svc
    .from('clients')
    .select('conversation_state')
    .eq('id', clientId)
    .maybeSingle();
  if (error) {
    console.error('[conversation-state] read failed:', error.message);
    return null;
  }
  const raw = (data as { conversation_state?: ConversationState | null } | null)?.conversation_state;
  return raw ?? null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await context.params;
  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const state = await readState(clientId);
  return NextResponse.json({ state: state ?? INITIAL_STATE });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await context.params;
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

  const validation = validateState(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const lastSeen = typeof body.lastSeenMessageId === 'string' ? body.lastSeenMessageId : null;
  if (lastSeen !== null) {
    const current = await readState(clientId);
    const serverTail = lastMessageId(current);
    if (serverTail !== null && serverTail !== lastSeen) {
      return NextResponse.json(
        { error: 'state-conflict', currentState: current ?? INITIAL_STATE },
        { status: 409 },
      );
    }
  }

  const svc = getServiceClient();
  const { error: updateError } = await svc
    .from('clients')
    .update({ conversation_state: validation.state } as never)
    .eq('id', clientId);
  if (updateError) {
    console.error('[conversation-state] update failed:', updateError.message);
    return NextResponse.json({ error: 'update-failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true, state: validation.state });
}
