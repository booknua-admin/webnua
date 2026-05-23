// =============================================================================
// POST /api/integrations/twilio/sender — register / refresh a client's
// alphanumeric SMS sender id.
//
// Phase 7 Twilio SMS session. Operator-only. The operator (in a client's
// sub-account SMS settings) provisions the alphanumeric sender:
//
//   action 'register' — submit the alphanumeric string. The route registers
//     it with Webnua's Twilio Messaging Service (as an AlphaSender resource),
//     then inserts the client_sms_senders row at status 'pending_approval'.
//   action 'refresh'  — poll Twilio for the sender's current state. When
//     Twilio confirms the AlphaSender resource is present, the row flips to
//     'approved' (the sender is usable).
//
// Reached by fetch() with the operator's Supabase access token on the
// Authorization header — same transport as the Stripe + OAuth integration
// routes. The body carries the client UUID.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  getSenderIDStatus,
  isSenderRegistrationConfigured,
  registerSenderID,
} from '@/lib/integrations/twilio/client';
import { getSenderByClientId, insertSender, updateSender } from '@/lib/integrations/twilio/senders';

// An alphanumeric sender id: 1–11 chars, letters + digits only, at least one
// letter (a purely numeric id is not a valid Twilio alphanumeric sender).
const SENDER_ID_RE = /^[A-Za-z0-9]{1,11}$/;

function validSenderId(value: string): boolean {
  return SENDER_ID_RE.test(value) && /[A-Za-z]/.test(value);
}

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown; senderId?: unknown; action?: unknown };
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

  const action = body.action === 'refresh' ? 'refresh' : 'register';
  return action === 'refresh' ? refreshSender(clientId) : registerSender(clientId, body.senderId);
}

// --- register ----------------------------------------------------------------

async function registerSender(clientId: string, rawSenderId: unknown): Promise<Response> {
  if (typeof rawSenderId !== 'string') {
    return NextResponse.json({ error: 'missing-senderId' }, { status: 400 });
  }
  const senderId = rawSenderId.trim();
  if (!validSenderId(senderId)) {
    return NextResponse.json({ error: 'invalid-senderId' }, { status: 400 });
  }

  // One sender per client — a row already exists.
  const existing = await getSenderByClientId(clientId);
  if (existing) {
    return NextResponse.json({ error: 'sender-exists' }, { status: 409 });
  }

  if (!isSenderRegistrationConfigured()) {
    return NextResponse.json({ error: 'twilio-not-configured' }, { status: 503 });
  }

  const result = await registerSenderID(clientId, senderId);
  if (!result.ok) {
    console.error('[twilio/sender] registerSenderID failed', result.error.message);
    return NextResponse.json(
      { error: 'twilio-register-failed', detail: result.error.message },
      { status: 502 },
    );
  }

  const row = await insertSender({
    clientId,
    senderId,
    status: 'pending_approval',
    twilioRegistrationSid: result.data.sid,
  });
  return NextResponse.json({ sender: row });
}

// --- refresh -----------------------------------------------------------------

async function refreshSender(clientId: string): Promise<Response> {
  const sender = await getSenderByClientId(clientId);
  if (!sender) {
    return NextResponse.json({ error: 'no-sender' }, { status: 404 });
  }
  if (!sender.twilio_registration_sid) {
    // Never registered with Twilio — nothing to poll.
    return NextResponse.json({ sender });
  }
  if (!isSenderRegistrationConfigured()) {
    return NextResponse.json({ error: 'twilio-not-configured' }, { status: 503 });
  }

  const result = await getSenderIDStatus(sender.twilio_registration_sid, clientId);
  if (!result.ok) {
    // The poll failed — leave the row's status untouched and report it. A
    // genuine "rejected" outcome is an operator-driven Console action, not
    // something a single failed poll should infer.
    return NextResponse.json(
      { sender, note: 'status-check-failed', detail: result.error.message },
      { status: 200 },
    );
  }

  // Twilio confirms the AlphaSender resource exists — the sender is usable.
  if (sender.status !== 'approved') {
    const updated = await updateSender(sender.id, { status: 'approved' });
    return NextResponse.json({ sender: updated });
  }
  return NextResponse.json({ sender });
}
