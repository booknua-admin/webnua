// =============================================================================
// Twilio SMS — job handlers.
//
// Phase 7 Twilio SMS session. Side-effect module: registers the send_sms job
// handler. Imported by job-handler-manifest.ts so the registration lands in
// the job executor's module graph.
//
//   send_sms — load the client's template, render it against the lead / job
//   context, validate the final length, send via Twilio, record the
//   sms_messages row. Enqueued by the lead-acknowledgment trigger (the public
//   form-submit route) and, in future, by the automation engine.
//
// Retry discipline: callExternal already retries Twilio 5xx / network errors
// in-process. A retryable error returned to the handler means those are
// exhausted — the handler re-throws so the JOB requeues (longer backoff, fresh
// attempts), UNLESS this is the job's last attempt, in which case it records a
// failed sms_messages row so the failure is visible in the send log. A
// non-retryable error (bad number, auth) records a failed row immediately —
// requeueing would not help. This avoids a duplicate row per retry: a thrown
// attempt records nothing; only a terminal outcome writes a row.
//
// SERVER-ONLY.
// =============================================================================

import { env, getAppBaseUrl } from '@/lib/env';
import type { IntegrationError } from '@/lib/integrations/_shared/call';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { type JobContext, registerJobHandler } from '@/lib/integrations/_shared/jobs';
import { validateTemplate } from '@/lib/sms/character-validator';
import { DEFAULT_SMS_TEMPLATES } from '@/lib/sms/default-templates';
import { normalizePhone } from '@/lib/sms/phone';
import { segmentCost } from '@/lib/sms/pricing';
import { render, type RenderContext } from '@/lib/sms/template-renderer';

import { isTwilioConfigured, mapTwilioMessageStatus, sendSMS } from './client';
import { insertSmsMessage } from './messages';
import { getSenderByClientId } from './senders';
import { getTemplate } from './templates';
import { SEND_SMS_JOB, type SendSmsPayload } from './job-types';
import type { ClientSmsSenderRow } from './types';

// --- the handler -------------------------------------------------------------

registerJobHandler(SEND_SMS_JOB, async (rawPayload, ctx: JobContext) => {
  const payload = (rawPayload ?? {}) as Partial<SendSmsPayload>;
  const { clientId, templateKey, recipientPhone } = payload;
  if (!clientId || !templateKey || !recipientPhone) {
    throw new Error('send_sms: payload missing clientId / templateKey / recipientPhone');
  }

  // Twilio unconfigured — skip honestly (no fake sms_messages row), same
  // pattern as the Stripe notify path's 'skipped' outcome.
  if (!isTwilioConfigured()) {
    return { skipped: true, reason: 'twilio-not-configured' };
  }

  // --- resolve the sender ----------------------------------------------------
  const sender = await getSenderByClientId(clientId);
  if (!sender) {
    return { skipped: true, reason: 'no-sender-assigned' };
  }
  if (sender.status !== 'approved') {
    // An unapproved alphanumeric sender would be rejected by the carrier;
    // skip rather than burn a send + a failed row.
    return { skipped: true, reason: `sender-${sender.status}` };
  }

  // --- normalise the recipient ----------------------------------------------
  const phone = normalizePhone(recipientPhone, env.TWILIO_DEFAULT_COUNTRY);
  if (!phone.ok) {
    await recordFailedSend(sender, recipientPhone, '', payload.relatedLeadId ?? null, {
      code: 'invalid_phone',
      message: `Could not normalise "${recipientPhone}" to an E.164 number.`,
    });
    return { sent: false, reason: 'invalid-phone' };
  }

  // --- render the message ----------------------------------------------------
  const template = await getTemplate(clientId, templateKey);
  const body = template?.body ?? DEFAULT_SMS_TEMPLATES[templateKey];
  const context = await buildRenderContext(clientId, sender.sender_id, payload);
  const rendered = render(body, context).text.trim();
  if (!rendered) {
    await recordFailedSend(sender, phone.e164, '', payload.relatedLeadId ?? null, {
      code: 'empty_body',
      message: 'The rendered SMS body was empty.',
    });
    return { sent: false, reason: 'empty-body' };
  }

  const validation = validateTemplate(rendered);
  const segments = Math.max(1, validation.segments);

  // --- send ------------------------------------------------------------------
  const base = getAppBaseUrl();
  const statusCallback = base ? `${base}/api/integrations/twilio/webhook` : undefined;
  const result = await sendSMS(sender.sender_id, phone.e164, rendered, {
    clientId,
    statusCallback,
  });

  if (result.ok) {
    const message = await insertSmsMessage({
      client_id: clientId,
      sender_id: sender.sender_id,
      recipient_phone: phone.e164,
      message_body: rendered,
      segments_count: segments,
      encoding: validation.segmentEncoding,
      twilio_message_sid: result.data.sid,
      status: mapTwilioMessageStatus(result.data.status),
      related_lead_id: payload.relatedLeadId ?? null,
      cost_eur: segmentCost(segments),
    });
    return { sent: true, messageId: message.id, twilioSid: result.data.sid, segments };
  }

  // --- failure ---------------------------------------------------------------
  const retryable = result.error.class === 'retryable' || result.error.class === 'rate_limited';
  const lastAttempt = ctx.attempts >= ctx.maxAttempts;

  // A retryable failure with attempts left → re-throw so the job requeues; no
  // row is written for an attempt that will be retried.
  if (retryable && !lastAttempt) {
    throw new Error(`send_sms: ${result.error.message}`);
  }

  // Terminal — record the failed send so it is visible in the log.
  const twilioError = extractTwilioError(result.error);
  await recordFailedSend(sender, phone.e164, rendered, payload.relatedLeadId ?? null, twilioError, {
    segments,
    encoding: validation.segmentEncoding,
  });
  return { sent: false, reason: 'twilio-error', error: twilioError.message };
});

export {};

// --- render context ----------------------------------------------------------

/** Build the render context: client + lead facts, then payload overrides. */
async function buildRenderContext(
  clientId: string,
  senderId: string,
  payload: Partial<SendSmsPayload>,
): Promise<RenderContext> {
  const db = getIntegrationDb();
  const { data: clientRow } = await db
    .from('clients')
    .select('name, primary_contact_phone')
    .eq('id', clientId)
    .maybeSingle();
  const client = clientRow as { name?: string; primary_contact_phone?: string | null } | null;

  const context: RenderContext = {
    'client.shortName': senderId,
    'client.businessName': client?.name ?? '',
    'client.phone': client?.primary_contact_phone ?? '',
    // No responseTime column exists — a sensible default. Override per-send
    // via the job payload's contextOverrides.
    'client.responseTime': '1 hour',
    'lead.firstName': 'there',
    'lead.service': 'your enquiry',
    'job.date': '',
    'job.time': '',
    'job.address': '',
    'job.eta': '',
    'review.link': '',
  };

  if (payload.relatedLeadId) {
    const lead = await loadLeadFacts(payload.relatedLeadId);
    if (lead.firstName) context['lead.firstName'] = lead.firstName;
    if (lead.service) context['lead.service'] = lead.service;
  }

  return { ...context, ...(payload.contextOverrides ?? {}) };
}

/** Resolve a lead's first name + the service it enquired about. */
async function loadLeadFacts(
  leadId: string,
): Promise<{ firstName: string | null; service: string | null }> {
  const db = getIntegrationDb();
  const { data: leadRow } = await db
    .from('leads')
    .select('customer_name_snapshot')
    .eq('id', leadId)
    .maybeSingle();
  const name = (leadRow as { customer_name_snapshot?: string } | null)?.customer_name_snapshot;

  // The service is not a lead column — best-effort from the form fields on the
  // opening form_submitted event.
  const { data: eventRow } = await db
    .from('lead_events')
    .select('payload')
    .eq('lead_id', leadId)
    .eq('kind', 'form_submitted')
    .order('occurred_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    firstName: firstNameOf(name ?? ''),
    service: serviceFromFormPayload((eventRow as { payload?: unknown } | null)?.payload),
  };
}

// --- failed-row recording -----------------------------------------------------

/** Record a failed send to sms_messages — the one place a failure is written. */
async function recordFailedSend(
  sender: ClientSmsSenderRow,
  recipientPhone: string,
  body: string,
  relatedLeadId: string | null,
  error: { code: string; message: string },
  meta?: { segments: number; encoding: 'gsm' | 'ucs2' },
): Promise<void> {
  await insertSmsMessage({
    client_id: sender.client_id,
    sender_id: sender.sender_id,
    recipient_phone: recipientPhone,
    message_body: body,
    segments_count: meta?.segments ?? 1,
    encoding: meta?.encoding ?? 'gsm',
    twilio_message_sid: null,
    status: 'failed',
    error_code: error.code,
    error_message: error.message,
    related_lead_id: relatedLeadId,
    cost_eur: 0,
  });
}

// --- pure helpers ------------------------------------------------------------

/** The first word of a customer name, or null when the name is empty or the
 *  generic public-form fallback ("Website enquiry"). */
function firstNameOf(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || /^website enquiry$/i.test(trimmed)) return null;
  return trimmed.split(/\s+/)[0];
}

const SERVICE_FIELD_RE = /service|enquir|need|help|job|work|project|interested/i;

/** Best-effort: pull a "service" value out of a form_submitted event payload. */
function serviceFromFormPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const fields = (payload as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return null;
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue;
    const label = (field as { label?: unknown }).label;
    const value = (field as { value?: unknown }).value;
    if (typeof label === 'string' && typeof value === 'string' && value.trim()) {
      if (SERVICE_FIELD_RE.test(label)) return value.trim();
    }
  }
  return null;
}

/** Pull the Twilio error code + message out of an IntegrationError. Twilio's
 *  JSON error body carries a numeric `code` and a `message`. */
function extractTwilioError(error: IntegrationError): { code: string; message: string } {
  let code = error.status ? String(error.status) : 'unknown';
  let message = error.message;
  const body = error.body;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (typeof obj.code === 'number' || typeof obj.code === 'string') code = String(obj.code);
    if (typeof obj.message === 'string' && obj.message.trim()) message = obj.message.trim();
  }
  return { code, message };
}
