// =============================================================================
// Twilio SMS — alphanumeric sender registration: auto-assign service + the
// `twilio_register_sender_id` job handler.
//
// Two concerns colocated because they share the same lifecycle:
//
//   • `enqueueSenderRegistration(clientId)` — called by the signup flows
//     (Pattern B conversational onboarding + the operator concierge
//     create-client flow) the moment a client's business name is known.
//     Derives a sender id from the business name, inserts a placeholder
//     `client_sms_senders` row at `pending_registration`, and enqueues a
//     background `twilio_register_sender_id` job. Idempotent on the client's
//     existing sender — calling twice while the row already exists returns
//     the existing row without enqueueing a second job.
//
//   • The `twilio_register_sender_id` handler — picks up the job, calls
//     Twilio's AlphaSender API, and lands the row at `pending_approval` on
//     success or `failed` on Twilio rejection. Records the failure code +
//     message so the operator UI can surface a meaningful diagnostic
//     ("Twilio credentials invalid" vs "sender already in use").
//
// SERVER-ONLY.
// =============================================================================

import type { IntegrationError } from '@/lib/integrations/_shared/call';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { enqueueJobImmediate, registerJobHandler } from '@/lib/integrations/_shared/jobs';

import {
  isSenderRegistrationConfigured,
  isTwilioConfigured,
  registerSenderID,
} from './client';
import { REGISTER_SENDER_JOB, type RegisterSenderPayload } from './job-types';
import { deriveAlphanumericSenderId, isValidAlphanumericSenderId } from './sender-derive';
import { getSenderByClientId, insertSender, updateSender } from './senders';

// --- public API: the signup-hook ---------------------------------------------

export type EnqueueSenderRegistrationResult =
  | { kind: 'enqueued'; senderId: string; rowId: string; jobId: string }
  | { kind: 'already_provisioned'; senderId: string; rowId: string }
  | { kind: 'skipped'; reason: 'twilio_not_configured' | 'missing_business_name' };

/**
 * Auto-assign + enqueue Twilio registration for a freshly-created client.
 * Idempotent — calling twice for the same client returns the existing row's
 * sender id without enqueueing a duplicate job.
 *
 * Always returns; never throws. The signup flow is critical-path and a
 * Twilio-side problem must not block account creation. Failures surface as
 * `last_failure_code` / `last_failure_message` on the row + integration_call_log.
 *
 * When Twilio is unconfigured the auto-assign path is skipped (no row
 * inserted). The operator can either set the env vars and call the same
 * function again from a "retry registration" affordance, or fall back to the
 * existing manual `/settings/sms` flow.
 */
export async function enqueueSenderRegistration(
  clientId: string,
): Promise<EnqueueSenderRegistrationResult> {
  // Idempotency: a row already exists. Common case = a job got re-enqueued
  // (eg. the signup flow ran twice on a refresh, or an operator clicked
  // retry while the original is still pending).
  const existing = await getSenderByClientId(clientId);
  if (existing) {
    return { kind: 'already_provisioned', senderId: existing.sender_id, rowId: existing.id };
  }

  // Not configured — nothing to enqueue. The row stays absent so the
  // operator's manual `/settings/sms` path is unaffected.
  if (!isTwilioConfigured() || !isSenderRegistrationConfigured()) {
    return { kind: 'skipped', reason: 'twilio_not_configured' };
  }

  // Read the client's business name + the existing-sender list for the
  // derivation. The business name lives on `clients.name`.
  const db = getIntegrationDb();
  const { data: clientRow } = await db
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();
  const businessName = (clientRow as { name?: string } | null)?.name?.trim() ?? '';
  if (!businessName) {
    return { kind: 'skipped', reason: 'missing_business_name' };
  }

  const existingSenders = await fetchAllSenderIds();
  const derived = deriveAlphanumericSenderId(businessName, {
    existingSenders,
    fallbackSeed: clientId,
  });

  if (!isValidAlphanumericSenderId(derived.senderId)) {
    // Defence in depth — the derivation guarantees a valid output, so this
    // branch is unreachable in practice. If we got here, log + skip rather
    // than insert a row that Twilio would reject anyway.
    console.error('[twilio/sender-registration] derived invalid sender', {
      clientId,
      derived,
    });
    return { kind: 'skipped', reason: 'missing_business_name' };
  }

  // Insert the row at pending_registration so the operator UI shows the
  // intended sender + the job-in-flight state.
  const row = await insertSender({
    clientId,
    senderId: derived.senderId,
    status: 'pending_registration',
    twilioRegistrationSid: null,
    notes:
      derived.warnings.length > 0
        ? `auto-assigned (warnings: ${derived.warnings.join(', ')})`
        : 'auto-assigned',
  });

  // Enqueue the background Twilio call. Fire-and-forget — the cron poller is
  // the safety net if the immediate self-POST fails.
  const jobId = await enqueueJobImmediate(
    REGISTER_SENDER_JOB,
    { clientId } satisfies RegisterSenderPayload,
    { provider: 'twilio', clientId, maxAttempts: 3 },
  );

  // Link the job to the row so the operator UI can see which job owns the
  // registration. Failures on this update are noisy but not fatal — the
  // job will still run.
  try {
    await db
      .from('client_sms_senders')
      .update({ registration_job_id: jobId })
      .eq('id', row.id);
  } catch (error) {
    console.warn('[twilio/sender-registration] failed to link job id', error);
  }

  return { kind: 'enqueued', senderId: derived.senderId, rowId: row.id, jobId };
}

// --- the handler -------------------------------------------------------------

registerJobHandler(REGISTER_SENDER_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as Partial<RegisterSenderPayload>;
  const clientId = payload.clientId;
  if (!clientId) throw new Error('twilio_register_sender_id: missing clientId');

  if (!isSenderRegistrationConfigured()) {
    // Skip honestly — leave the row at pending_registration. The operator
    // can fix env + manually retry from the UI.
    await markFailure(clientId, 'twilio_not_configured', 'Twilio credentials or Messaging Service SID are not set.');
    return { skipped: true, reason: 'twilio_not_configured' };
  }

  const sender = await getSenderByClientId(clientId);
  if (!sender) {
    // The placeholder row got cleaned up (operator deleted via a future
    // retry affordance, or the client was deleted mid-job). Nothing to do.
    return { skipped: true, reason: 'no_row' };
  }

  // Already terminal — skip. Belt-and-braces in case of a re-enqueue race.
  if (sender.status === 'approved' || sender.status === 'pending_approval') {
    return { skipped: true, reason: `already_${sender.status}` };
  }

  const senderId = payload.overrideSenderId?.trim() || sender.sender_id;
  const result = await registerSenderID(clientId, senderId);

  if (result.ok) {
    await updateSender(sender.id, {
      status: 'pending_approval',
      twilioRegistrationSid: result.data.sid,
    });
    await markAttempt(sender.id, null);
    return { ok: true, twilio_sid: result.data.sid };
  }

  // --- failure path ---------------------------------------------------------
  const detail = extractTwilioError(result.error);

  if (detail.isAuthFailure) {
    // Auth (20003) — credentials need fixing in env. Mark failed; operator
    // surfaces a "fix credentials" affordance + retries from the UI.
    await markFailure(
      clientId,
      'auth_failed',
      'Twilio rejected the credentials. Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in the deployment environment, then retry.',
    );
    return { ok: false, reason: 'auth_failed' };
  }

  if (detail.code === '21610' || detail.twilioMessage.toLowerCase().includes('already')) {
    // 21610 = sender already registered. Rare under the derivation's
    // collision-avoidance, but a duplicate on the Twilio side means we lost
    // a race or someone manually registered the same string.
    await markFailure(clientId, 'sender_in_use', `Twilio reports "${senderId}" is already registered on this Messaging Service.`);
    return { ok: false, reason: 'sender_in_use' };
  }

  await markFailure(clientId, detail.code, detail.twilioMessage);
  return { ok: false, reason: 'twilio_rejected', code: detail.code };
});

// re-export for the manifest's side-effect import.
export {};

// --- helpers -----------------------------------------------------------------

async function fetchAllSenderIds(): Promise<string[]> {
  const { data, error } = await getIntegrationDb()
    .from('client_sms_senders')
    .select('sender_id');
  if (error) {
    console.warn('[twilio/sender-registration] failed to list existing senders', error);
    return [];
  }
  return ((data as { sender_id: string }[] | null) ?? []).map((r) => r.sender_id);
}

/** Mark the sender row as failed + record the diagnostic. The row stays in
 *  place so the operator UI can show what was attempted; an operator retry
 *  re-enqueues the job + flips the row back to pending_registration. */
async function markFailure(clientId: string, code: string, message: string): Promise<void> {
  await getIntegrationDb()
    .from('client_sms_senders')
    .update({
      status: 'failed',
      last_registration_attempt_at: new Date().toISOString(),
      last_failure_code: code,
      last_failure_message: message,
      registration_job_id: null,
    })
    .eq('client_id', clientId);
}

/** Mark a successful attempt's timestamp + clear failure context. */
async function markAttempt(rowId: string, failureCode: string | null): Promise<void> {
  await getIntegrationDb()
    .from('client_sms_senders')
    .update({
      last_registration_attempt_at: new Date().toISOString(),
      last_failure_code: failureCode,
      last_failure_message: failureCode ? null : null,
      registration_job_id: null,
    })
    .eq('id', rowId);
}

type ExtractedError = { code: string; twilioMessage: string; isAuthFailure: boolean };
function extractTwilioError(error: IntegrationError): ExtractedError {
  let code = error.status ? String(error.status) : 'unknown';
  let twilioMessage = error.message;
  const body = error.body;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.code === 'number' || typeof obj.code === 'string') code = String(obj.code);
    if (typeof obj.message === 'string' && obj.message.trim()) twilioMessage = obj.message.trim();
  }
  const isAuthFailure = code === '20003' || error.class === 'auth_failed' || error.status === 401;
  return { code, twilioMessage, isAuthFailure };
}
