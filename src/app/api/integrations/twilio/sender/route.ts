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

import type { IntegrationError } from '@/lib/integrations/_shared/call';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  getSenderIDStatus,
  isSenderRegistrationConfigured,
  registerSenderID,
} from '@/lib/integrations/twilio/client';
import { REGISTER_SENDER_JOB, type RegisterSenderPayload } from '@/lib/integrations/twilio/job-types';
import { getSenderByClientId, insertSender, updateSender } from '@/lib/integrations/twilio/senders';
import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

/**
 * Extract Twilio's error code + a user-readable message from an
 * IntegrationError. Twilio error code 20003 = authentication failure (wrong
 * Account SID / Auth Token); it presents as HTTP 401 with body
 * `{ code: 20003, message: "Authenticate" }`. The bare "Authenticate" string
 * is not actionable for an operator — the caller surfaces a specific message
 * for this case.
 */
type TwilioErrorDetail = {
  code: string;
  twilioMessage: string;
  userMessage: string;
  isAuthFailure: boolean;
};
function extractTwilioError(error: IntegrationError): TwilioErrorDetail {
  let code = error.status ? String(error.status) : 'unknown';
  let twilioMessage = error.message;
  const body = error.body;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.code === 'number' || typeof obj.code === 'string') code = String(obj.code);
    if (typeof obj.message === 'string' && obj.message.trim()) twilioMessage = obj.message.trim();
  }
  const isAuthFailure = code === '20003' || error.class === 'auth_failed' || error.status === 401;
  const userMessage = isAuthFailure
    ? 'Twilio rejected the credentials. Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your deployment environment.'
    : twilioMessage;
  return { code, twilioMessage, userMessage, isAuthFailure };
}

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

  const action = typeof body.action === 'string' ? body.action : 'register';
  if (action === 'refresh') return refreshSender(clientId);
  if (action === 'retry') return retrySender(clientId);
  return registerSender(clientId, body.senderId);
}

// --- retry -------------------------------------------------------------------

/**
 * Re-attempt registration for a sender that landed at status='failed' or is
 * stuck at 'pending_registration' (eg. auto-assign job dispatched but then
 * env was misconfigured). The operator fixes the underlying issue
 * (credentials, Messaging Service SID) and clicks Retry. This route flips
 * the row back to pending_registration + enqueues a fresh
 * twilio_register_sender_id job. The handler picks it up and either succeeds
 * (sender lands at pending_approval) or fails again with a fresh
 * last_failure_message.
 *
 * Distinct from `refresh` (which polls Twilio for status of an already-
 * registered AlphaSender) and `register` (which submits a brand-new sender
 * id from operator-typed input).
 */
async function retrySender(clientId: string): Promise<Response> {
  const sender = await getSenderByClientId(clientId);
  if (!sender) {
    return NextResponse.json({ error: 'no-sender' }, { status: 404 });
  }
  if (sender.status === 'approved' || sender.status === 'pending_approval') {
    // Already in a good state — nothing to retry.
    return NextResponse.json({ sender, note: 'already-registered' });
  }
  if (!isSenderRegistrationConfigured()) {
    return NextResponse.json({ error: 'twilio-not-configured' }, { status: 503 });
  }

  // Reset diagnostic + flip back to pending_registration so the UI shows
  // "in flight" again immediately.
  await getIntegrationDb()
    .from('client_sms_senders')
    .update({
      status: 'pending_registration',
      last_failure_code: null,
      last_failure_message: null,
    })
    .eq('id', sender.id);

  const jobId = await enqueueJobImmediate(
    REGISTER_SENDER_JOB,
    { clientId } satisfies RegisterSenderPayload,
    { provider: 'twilio', clientId, maxAttempts: 3 },
  );
  await getIntegrationDb()
    .from('client_sms_senders')
    .update({ registration_job_id: jobId })
    .eq('id', sender.id);

  return NextResponse.json({ ok: true, jobId });
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
    // Surface authentication failures distinctly — error 20003 is Twilio
    // rejecting the credentials. Treating it as a generic "register failed"
    // sends the operator down the wrong debugging path (re-checking the
    // sender format / Messaging Service config) when the real fix is in
    // deployment env vars. See PR A — Twilio 401 root-cause documentation.
    const twilio = extractTwilioError(result.error);
    if (twilio.isAuthFailure) {
      console.error('[twilio/sender] auth failed — credentials invalid', twilio);
      return NextResponse.json(
        {
          error: 'twilio-auth-failed',
          detail:
            'Twilio rejected the request — TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN are invalid for this Twilio account. Verify the credentials in your deployment environment, then try again.',
          twilioCode: twilio.code,
        },
        { status: 502 },
      );
    }
    console.error('[twilio/sender] registerSenderID failed', twilio);
    return NextResponse.json(
      {
        error: 'twilio-register-failed',
        detail: twilio.userMessage,
        twilioCode: twilio.code,
      },
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
