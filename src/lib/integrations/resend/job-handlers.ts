// =============================================================================
// Resend email — job handlers.
//
// Phase 7 Resend session. Side-effect module: registers the email job
// handlers. Imported by job-handler-manifest.ts so the registrations land
// in the executor's module graph.
//
//   send_email                — load template, render, send via Resend, log.
//                                Used for: lead nurture, review request,
//                                quote follow-up, operator notification, the
//                                operator's reply-from-inbox path.
//   send_lead_notification    — fires when a new lead is created (via the
//                                AFTER INSERT trigger in 0063). Resolves
//                                recipients, runs the throttle, dispatches
//                                send_email or sets notification_pending_at.
//   batch_notification_digest — hourly worker (pg_cron in 0063). Batches
//                                pending lead notifications by client and
//                                sends one digest email per (client,
//                                recipient).
//   send_test_notification    — operator-triggered test send from the
//                                settings UI.
//
// Retry discipline mirrors the send_sms handler: callExternal already retries
// 5xx / network in-process. A retryable error reaching the handler with
// attempts remaining re-throws (so the job requeues). A non-retryable error
// records a 'failed' email_messages row immediately — re-throwing would burn
// retries on a guaranteed failure.
//
// SERVER-ONLY.
// =============================================================================

import { getAppBaseUrl } from '@/lib/env';
import { env } from '@/lib/env';
import {
  DEFAULT_EMAIL_TEMPLATES,
  type EmailTemplateBody,
} from '@/lib/email/default-templates';
import {
  appendCustomerFooter,
  renderEmail,
  type EmailRenderContext,
} from '@/lib/email/templates';
// Phase 8 Session 2: the sms_templates / email_templates tables are gone.
// Bodies live on the originating automation_action's action_config (or in
// DEFAULT_EMAIL_TEMPLATES for operator-facing keys). The previous
// `getTemplate` lookup is no longer used.
import {
  composeReplyToAddress,
  generateThreadToken,
} from '@/lib/email/threading';
import type { IntegrationError } from '@/lib/integrations/_shared/call';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { getReviewLinkForClient } from '@/lib/integrations/gbp/locations';
import {
  enqueueJob,
  enqueueJobImmediate,
  type JobContext,
  registerJobHandler,
} from '@/lib/integrations/_shared/jobs';

import { isResendConfigured, sendEmail as resendSend } from './client';
import {
  BATCH_NOTIFICATION_DIGEST_JOB,
  NEW_LEAD_THROTTLE_MINUTES,
  SEND_EMAIL_JOB,
  SEND_LEAD_NOTIFICATION_JOB,
  SEND_TEST_NOTIFICATION_JOB,
  type SendEmailPayload,
  type SendLeadNotificationPayload,
  type SendTestNotificationPayload,
} from './job-types';
import { insertEmailMessage } from './messages';
import {
  insertNotificationOutbound,
  lastSentAtForRecipient,
  listNewLeadRecipients,
} from './preferences';
import { getSenderByClientId } from './senders';
import type {
  ClientEmailSenderRow,
  EmailMessageStatus,
  EmailTemplateKey,
  NotificationPreferenceRow,
} from './types';

// ============================================================================
// send_email — the workhorse handler.
// ============================================================================

registerJobHandler(SEND_EMAIL_JOB, async (rawPayload, ctx: JobContext) => {
  const payload = (rawPayload ?? {}) as Partial<SendEmailPayload>;
  const { clientId, templateKey, recipientEmail } = payload;
  if (!clientId || !templateKey || !recipientEmail) {
    throw new Error('send_email: payload missing clientId / templateKey / recipientEmail');
  }

  if (!isResendConfigured()) {
    return { skipped: true, reason: 'resend-not-configured' };
  }

  // --- resolve the sender ----------------------------------------------------
  const sender = await getSenderByClientId(clientId);
  if (!sender) {
    return { skipped: true, reason: 'no-sender-assigned' };
  }
  if (sender.status !== 'active') {
    return { skipped: true, reason: `sender-${sender.status}` };
  }

  // --- render ---------------------------------------------------------------
  // Body source priority (see resolveTemplateBody for full detail):
  //   1. Payload-supplied subject + body — customer-facing automation actions
  //      (Phase 8 Session 2 inline-body model).
  //   2. platform_email_templates row — operator-facing system templates
  //      (Phase 8 Session 3, `lead_notification` / `lead_digest`).
  //   3. DEFAULT_EMAIL_TEMPLATES[templateKey] — in-code fallback.
  // The per-client sms_templates / email_templates tables are gone.
  const template = await resolveTemplateBody(payload, templateKey);
  const context = await buildRenderContext(clientId, sender, payload);
  const rendered = renderEmail(template, context);
  if (!rendered.subject && !rendered.text && !rendered.html) {
    await recordFailedSend(sender, payload, '', '', '', {
      code: 'empty_body',
      message: 'The rendered email had no subject + no body.',
    });
    return { sent: false, reason: 'empty-body' };
  }

  // Customer-facing emails (operator → lead) ship plain-text only with the
  // "Powered by Webnua" footer. Operator-facing emails (Webnua → operator)
  // keep their branded HTML.
  let finalText = rendered.text;
  let finalHtml = rendered.html;
  if (isCustomerFacingTemplate(templateKey)) {
    finalText = appendCustomerFooter(rendered.text);
    finalHtml = '';
  }

  // --- threading ------------------------------------------------------------
  // Only outbound emails to a known lead carry a reply-to thread token —
  // operator notifications and the digest go to operators (who reply to us
  // out-of-band) and don't need an inbound routing token.
  const threadToken =
    payload.relatedLeadId && isCustomerFacingTemplate(templateKey)
      ? generateThreadToken()
      : null;
  const replyTo = threadToken
    ? composeReplyToAddress(sender.slug, threadToken)
    : undefined;

  // --- send ----------------------------------------------------------------
  const fromAddress = `${sender.display_name} <${sender.slug}@${env.EMAIL_SENDING_DOMAIN}>`;
  const result = await resendSend({
    clientId,
    from: fromAddress,
    to: recipientEmail,
    replyTo,
    subject: rendered.subject,
    text: finalText,
    html: finalHtml,
    inReplyTo: payload.inReplyTo ?? undefined,
    attachments: payload.attachments,
    correlationId: ctx.correlationId ?? undefined,
  });

  if (result.ok) {
    const row = await insertEmailMessage({
      client_id: clientId,
      direction: 'outbound',
      sender_address: fromAddress,
      recipient_address: recipientEmail,
      reply_to_address: replyTo ?? null,
      subject: rendered.subject,
      body_text: finalText,
      body_html: finalHtml,
      resend_message_id: result.data.id,
      in_reply_to_message_id: payload.inReplyTo ?? null,
      status: 'sent',
      related_lead_id: payload.relatedLeadId ?? null,
      thread_token: threadToken,
      attachments: [],
      correlation_id: ctx.correlationId,
      sent_by: payload.sentByUserId ?? null,
    });
    // Operator-facing templates also write a notifications_outbound row so
    // the throttle query (and the historical Stripe code) reads it back.
    if (!isCustomerFacingTemplate(templateKey)) {
      await insertNotificationOutbound({
        clientId,
        recipientEmail,
        templateName: templateKey,
        status: 'sent',
        resendMessageId: result.data.id,
        relatedLeadId: payload.relatedLeadId ?? null,
      });
    }
    return { sent: true, messageId: row.id, resendId: result.data.id };
  }

  // --- failure --------------------------------------------------------------
  const retryable = result.error.class === 'retryable' || result.error.class === 'rate_limited';
  const lastAttempt = ctx.attempts >= ctx.maxAttempts;
  if (retryable && !lastAttempt) {
    throw new Error(`send_email: ${result.error.message}`);
  }
  const resendError = extractResendError(result.error);
  await recordFailedSend(
    sender,
    payload,
    fromAddress,
    rendered.subject,
    finalText,
    resendError,
    threadToken,
  );
  if (!isCustomerFacingTemplate(templateKey)) {
    await insertNotificationOutbound({
      clientId,
      recipientEmail,
      templateName: templateKey,
      status: 'failed',
      resendMessageId: null,
      relatedLeadId: payload.relatedLeadId ?? null,
    });
  }
  return { sent: false, reason: 'resend-error', error: resendError.message };
});

// ============================================================================
// send_lead_notification — fan-out to operator recipients with throttling.
// ============================================================================

registerJobHandler(SEND_LEAD_NOTIFICATION_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as Partial<SendLeadNotificationPayload>;
  const { clientId, leadId } = payload;
  if (!clientId || !leadId) {
    throw new Error('send_lead_notification: payload missing clientId / leadId');
  }

  const recipients = await listNewLeadRecipients(clientId);
  if (recipients.length === 0) {
    return { skipped: true, reason: 'no-recipients' };
  }

  let immediate = 0;
  let deferred = 0;
  const now = Date.now();
  const throttleMs = NEW_LEAD_THROTTLE_MINUTES * 60 * 1000;

  for (const recipient of recipients) {
    // Hourly / daily frequency recipients always go through the digest path.
    if (recipient.digest_frequency !== 'immediate') {
      deferred += 1;
      continue;
    }
    const lastSent = await lastSentAtForRecipient(
      clientId,
      recipient.operator_email,
      'lead_notification',
    );
    if (lastSent && now - lastSent.getTime() < throttleMs) {
      deferred += 1;
      continue;
    }
    await enqueueJobImmediate(
      SEND_EMAIL_JOB,
      {
        clientId,
        templateKey: 'lead_notification' satisfies EmailTemplateKey,
        recipientEmail: recipient.operator_email,
        relatedLeadId: leadId,
      } satisfies SendEmailPayload,
      { provider: 'resend', clientId, correlationId: leadId },
    );
    immediate += 1;
  }

  // If anyone was throttled, mark the lead as having a pending notification —
  // the hourly digest picks it up.
  if (deferred > 0) {
    await markLeadNotificationPending(leadId);
  }

  return { immediate, deferred };
});

// ============================================================================
// batch_notification_digest — hourly digest worker.
// ============================================================================

registerJobHandler(BATCH_NOTIFICATION_DIGEST_JOB, async () => {
  const db = getIntegrationDb();

  // 1. Find every lead carrying notification_pending_at, group by client.
  const { data: pendingRows, error } = await db
    .from('leads')
    .select(
      'id, client_id, customer_name_snapshot, customer_phone_snapshot, source, ' +
        'notification_pending_at, ' +
        'customer:customers(email), ' +
        'lead_events(kind, payload)',
    )
    .not('notification_pending_at', 'is', null)
    .order('notification_pending_at', { ascending: true });
  if (error) throw new Error(`batch_notification_digest: ${error.message}`);
  const leads = (pendingRows as unknown as PendingLeadRow[] | null) ?? [];
  if (leads.length === 0) return { batches: 0, sent: 0 };

  const byClient = new Map<string, PendingLeadRow[]>();
  for (const lead of leads) {
    const list = byClient.get(lead.client_id) ?? [];
    list.push(lead);
    byClient.set(lead.client_id, list);
  }

  let batches = 0;
  let sent = 0;

  for (const [clientId, leadsForClient] of byClient) {
    const recipients = await listNewLeadRecipients(clientId);
    if (recipients.length === 0) {
      // No one to notify — still clear the flags so they don't pile up.
      await clearNotificationPending(leadsForClient.map((l) => l.id));
      continue;
    }
    const summary = formatDigestSummary(leadsForClient);
    const summaryHtml = formatDigestSummaryHtml(leadsForClient);
    for (const recipient of recipients) {
      batches += 1;
      await enqueueJob(
        SEND_EMAIL_JOB,
        {
          clientId,
          templateKey: 'lead_digest' satisfies EmailTemplateKey,
          recipientEmail: recipient.operator_email,
          contextOverrides: {
            'digest.count': String(leadsForClient.length),
            'digest.summary': summary,
            'digest.summaryHtml': summaryHtml,
          },
        } satisfies SendEmailPayload,
        { provider: 'resend', clientId },
      );
      sent += 1;
    }
    await clearNotificationPending(leadsForClient.map((l) => l.id));
  }

  return { batches, sent };
});

// ============================================================================
// send_test_notification — fires a synthetic lead_notification for the
// "Test send" button on the operator settings UI.
// ============================================================================

registerJobHandler(SEND_TEST_NOTIFICATION_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as Partial<SendTestNotificationPayload>;
  const { clientId, recipientEmail } = payload;
  if (!clientId || !recipientEmail) {
    throw new Error('send_test_notification: missing clientId / recipientEmail');
  }
  await enqueueJobImmediate(
    SEND_EMAIL_JOB,
    {
      clientId,
      templateKey: 'lead_notification',
      recipientEmail,
      contextOverrides: {
        'lead.firstName': 'Test',
        'lead.lastNameSuffix': ' Lead',
        'lead.fullName': 'Test Lead',
        'lead.email': 'test@example.com',
        'lead.phone': '+61 412 000 000',
        'lead.service': 'this is a test send from your notification settings',
        'lead.preview': 'No real lead — this is a test of the email pipeline.',
      },
    } satisfies SendEmailPayload,
    { provider: 'resend', clientId },
  );
  return { enqueued: true };
});

export {};

// ============================================================================
// Helpers
// ============================================================================

type PendingLeadRow = {
  id: string;
  client_id: string;
  customer_name_snapshot: string;
  customer_phone_snapshot: string | null;
  source: string | null;
  notification_pending_at: string | null;
  customer: { email: string | null } | null;
  lead_events: { kind: string; payload: unknown }[];
};

/** True for templates whose recipient is the lead (customer-facing). */
function isCustomerFacingTemplate(key: EmailTemplateKey): boolean {
  return key === 'lead_followup' || key === 'review_request' || key === 'quote_followup';
}

/** True for operator-facing templates that live at platform level (one body
 *  for all clients). Phase 8 · Session 3 added the `platform_email_templates`
 *  table — when a row exists for one of these keys, it wins over the in-code
 *  default; absent rows fall through to `DEFAULT_EMAIL_TEMPLATES`. */
function isPlatformLevelTemplate(key: EmailTemplateKey): boolean {
  return key === 'lead_notification' || key === 'lead_digest';
}

async function loadPlatformTemplate(
  key: EmailTemplateKey,
): Promise<EmailTemplateBody | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('platform_email_templates')
    .select('subject, body_html, body_text')
    .eq('template_key', key)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { subject: string; body_html: string; body_text: string };
  return {
    subject: row.subject,
    body_html: row.body_html,
    body_text: row.body_text,
  };
}

/** Pick the email body source.
 *
 * Resolution order:
 *   1. Payload-supplied subject + body — customer-facing automation actions
 *      pass the inline body straight from `automation_actions.action_config`
 *      (Phase 8 Session 2 inline-body model).
 *   2. Platform-level template row (Phase 8 Session 3) — for operator-facing
 *      keys (`lead_notification`, `lead_digest`), an operator can override
 *      the body via `platform_email_templates`.
 *   3. `DEFAULT_EMAIL_TEMPLATES[key]` — the in-code fallback.
 *
 * The per-client `email_templates` table no longer exists (deleted in
 * Session 2). */
async function resolveTemplateBody(
  payload: Partial<SendEmailPayload>,
  key: EmailTemplateKey,
): Promise<EmailTemplateBody> {
  const hasPayloadBody =
    typeof payload.subject === 'string' &&
    (typeof payload.bodyHtml === 'string' || typeof payload.bodyText === 'string');

  if (hasPayloadBody) {
    return {
      subject: payload.subject ?? '',
      body_html: payload.bodyHtml ?? '',
      body_text: payload.bodyText ?? '',
    };
  }
  if (isPlatformLevelTemplate(key)) {
    const platform = await loadPlatformTemplate(key);
    if (platform) return platform;
  }
  return DEFAULT_EMAIL_TEMPLATES[key];
}

async function buildRenderContext(
  clientId: string,
  sender: ClientEmailSenderRow,
  payload: Partial<SendEmailPayload>,
): Promise<EmailRenderContext> {
  const db = getIntegrationDb();
  const { data: clientRow } = await db
    .from('clients')
    .select('name, primary_contact_phone, slug, response_time_promise')
    .eq('id', clientId)
    .maybeSingle();
  const client = clientRow as
    | {
        name?: string;
        primary_contact_phone?: string | null;
        slug?: string;
        response_time_promise?: string | null;
      }
    | null;

  const baseUrl = getAppBaseUrl();
  const inboxLink = baseUrl ? `${baseUrl}/leads` : '/leads';

  // Resolve the GBP review link for this client (when one is connected) so
  // {{review.link}} substitutes to the real Google review deep-link. Falls
  // back to an empty string when the client has no GBP location yet —
  // contextOverrides on the payload can still force a value.
  const reviewLink = await getReviewLinkForClient(clientId);

  const ctx: EmailRenderContext = {
    'client.shortName': sender.display_name || client?.name || 'Webnua',
    'client.businessName': client?.name ?? '',
    'client.phone': client?.primary_contact_phone ?? '',
    // Operator-editable on /settings/profile (added migration 0111).
    'client.responseTime': client?.response_time_promise?.trim() || '1 hour',
    'lead.firstName': payload.recipientName?.split(/\s+/)[0] ?? 'there',
    'lead.lastNameSuffix': '',
    'lead.fullName': payload.recipientName ?? '',
    'lead.email': '',
    'lead.phone': '',
    'lead.service': 'your enquiry',
    'lead.preview': '',
    'job.date': '',
    'job.time': '',
    'job.address': '',
    'job.eta': '',
    'review.link': reviewLink ?? '',
    'platform.inboxLink': inboxLink,
    'digest.count': '',
    'digest.summary': '',
  };

  if (payload.relatedLeadId) {
    const lead = await loadLeadFacts(payload.relatedLeadId);
    if (lead.firstName) ctx['lead.firstName'] = lead.firstName;
    if (lead.lastNameSuffix) ctx['lead.lastNameSuffix'] = lead.lastNameSuffix;
    if (lead.fullName) ctx['lead.fullName'] = lead.fullName;
    if (lead.email) ctx['lead.email'] = lead.email;
    if (lead.phone) ctx['lead.phone'] = lead.phone;
    if (lead.service) ctx['lead.service'] = lead.service;
    if (lead.preview) ctx['lead.preview'] = lead.preview;
  }

  if (payload.relatedBookingId) {
    const job = await loadBookingFacts(payload.relatedBookingId);
    if (job.date) ctx['job.date'] = job.date;
    if (job.time) ctx['job.time'] = job.time;
    if (job.address) ctx['job.address'] = job.address;
    if (job.eta) ctx['job.eta'] = job.eta;
  }

  return { ...ctx, ...(payload.contextOverrides ?? {}) };
}

/** Resolve `{{job.*}}` facts from a booking row. Mirrors the Twilio handler's
 *  loadBookingFacts — same fallback to customer.address, same UTC-read time
 *  formatters. Kept inline rather than extracted because the two handlers
 *  are the only consumers and a shared module would couple two integration
 *  surfaces that are otherwise independent. */
async function loadBookingFacts(bookingId: string): Promise<{
  date: string | null;
  time: string | null;
  address: string | null;
  eta: string | null;
}> {
  const db = getIntegrationDb();
  const { data } = await db
    .from('bookings')
    .select('starts_at, address, customer:customers(address)')
    .eq('id', bookingId)
    .maybeSingle();
  const row = data as
    | {
        starts_at: string;
        address: string | null;
        customer: { address: string | null } | null;
      }
    | null;
  if (!row) {
    return { date: null, time: null, address: null, eta: null };
  }
  return {
    date: formatJobDate(row.starts_at),
    time: formatJobTime(row.starts_at),
    address: row.address ?? row.customer?.address ?? null,
    eta: formatJobEta(row.starts_at),
  };
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatJobDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

function formatJobTime(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatJobEta(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`;
  const hours = Math.round(mins / 60);
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

async function loadLeadFacts(leadId: string): Promise<{
  firstName: string | null;
  lastNameSuffix: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  service: string | null;
  preview: string | null;
}> {
  const db = getIntegrationDb();
  const { data } = await db
    .from('leads')
    .select(
      'customer_name_snapshot, customer_phone_snapshot, customer:customers(email), ' +
        'lead_events(kind, payload)',
    )
    .eq('id', leadId)
    .maybeSingle();
  const lead = data as
    | {
        customer_name_snapshot?: string;
        customer_phone_snapshot?: string | null;
        customer?: { email?: string | null } | null;
        lead_events?: { kind: string; payload: unknown }[];
      }
    | null;
  if (!lead) {
    return {
      firstName: null,
      lastNameSuffix: null,
      fullName: null,
      email: null,
      phone: null,
      service: null,
      preview: null,
    };
  }
  const name = (lead.customer_name_snapshot ?? '').trim();
  const generic = !name || /^website enquiry$/i.test(name);
  const parts = name.split(/\s+/);
  const first = generic ? null : (parts[0] ?? null);
  const rest = generic || parts.length < 2 ? '' : parts.slice(1).join(' ');
  return {
    firstName: first,
    lastNameSuffix: rest ? ` ${rest}` : '',
    fullName: generic ? null : name,
    email: lead.customer?.email ?? null,
    phone: lead.customer_phone_snapshot ?? null,
    service: serviceFromEvents(lead.lead_events ?? []),
    preview: previewFromEvents(lead.lead_events ?? []),
  };
}

const SERVICE_FIELD_RE = /service|enquir|need|help|job|work|project|interested/i;

/** Resolve a service value from a lead's events. Mirrors the Twilio handler's
 *  serviceFromFormPayload — prefer the `leadRole === 'service'` tag, fall
 *  back to a label regex match for legacy forms. */
function serviceFromEvents(
  events: { kind: string; payload: unknown }[],
): string | null {
  // Pass 1 — tagged field wins.
  for (const e of events) {
    if (e.kind !== 'form_submitted') continue;
    const payload = e.payload as { fields?: unknown } | null;
    const fields = payload?.fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      const f = field as { leadRole?: unknown; value?: unknown };
      if (f.leadRole === 'service' && typeof f.value === 'string' && f.value.trim()) {
        return f.value.trim();
      }
    }
  }
  // Pass 2 — legacy label regex.
  for (const e of events) {
    if (e.kind !== 'form_submitted') continue;
    const payload = e.payload as { fields?: unknown } | null;
    const fields = payload?.fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      const f = field as { label?: unknown; value?: unknown };
      if (typeof f.label === 'string' && typeof f.value === 'string' && f.value.trim()) {
        if (SERVICE_FIELD_RE.test(f.label)) return f.value.trim();
      }
    }
  }
  return null;
}

function previewFromEvents(
  events: { kind: string; payload: unknown }[],
): string | null {
  // First form_submitted's first non-empty value is a decent inbox preview.
  for (const e of events) {
    if (e.kind !== 'form_submitted') continue;
    const payload = e.payload as { fields?: unknown } | null;
    const fields = payload?.fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      const f = field as { value?: unknown };
      if (typeof f.value === 'string' && f.value.trim()) {
        return f.value.slice(0, 240);
      }
    }
  }
  return null;
}

async function recordFailedSend(
  sender: ClientEmailSenderRow,
  payload: Partial<SendEmailPayload>,
  fromAddress: string,
  subject: string,
  body_text: string,
  error: { code: string; message: string },
  threadToken: string | null = null,
): Promise<void> {
  await insertEmailMessage({
    client_id: sender.client_id,
    direction: 'outbound',
    sender_address:
      fromAddress || `${sender.display_name} <${sender.slug}@${env.EMAIL_SENDING_DOMAIN}>`,
    recipient_address: payload.recipientEmail ?? '',
    subject: subject || '(send failed before render)',
    body_text: body_text + (error.message ? `\n\n[send failed: ${error.message}]` : ''),
    body_html: '',
    status: 'failed' satisfies EmailMessageStatus,
    related_lead_id: payload.relatedLeadId ?? null,
    thread_token: threadToken,
    sent_by: payload.sentByUserId ?? null,
  });
}

async function markLeadNotificationPending(leadId: string): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from('leads')
    .update({ notification_pending_at: new Date().toISOString() })
    .eq('id', leadId);
  if (error) console.warn('[resend/jobs] mark notification_pending failed', error.message);
}

async function clearNotificationPending(leadIds: string[]): Promise<void> {
  if (leadIds.length === 0) return;
  const db = getIntegrationDb();
  const { error } = await db
    .from('leads')
    .update({ notification_pending_at: null })
    .in('id', leadIds);
  if (error) console.warn('[resend/jobs] clear notification_pending failed', error.message);
}

function formatDigestSummary(leads: PendingLeadRow[]): string {
  return leads
    .map((lead) => {
      const name = lead.customer_name_snapshot || 'New enquiry';
      const service = serviceFromEvents(lead.lead_events ?? []) || lead.source || 'enquiry';
      return `• ${name} — ${service}`;
    })
    .join('\n');
}

function escapeHtmlForDigest(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
}

/** Render the lead-digest summary as a stacked card list — one row per lead
 *  with a rust left-rail (matches the lead_notification single-lead block).
 *  Sibling of `formatDigestSummary` (the plain-text version). */
function formatDigestSummaryHtml(leads: PendingLeadRow[]): string {
  return leads
    .map((lead) => {
      const name = escapeHtmlForDigest(lead.customer_name_snapshot || 'New enquiry');
      const service = escapeHtmlForDigest(
        serviceFromEvents(lead.lead_events ?? []) || lead.source || 'enquiry',
      );
      return (
        `<div style="margin:0 0 8px 0;padding:10px 14px;background:#f5f1ea;border-left:3px solid #d24317;border-radius:6px;">` +
        `<div style="font-weight:700;font-size:14px;color:#0a0a0a;">${name}</div>` +
        `<div style="font-size:13px;color:#4a4a45;margin-top:2px;">${service}</div>` +
        `</div>`
      );
    })
    .join('');
}

function extractResendError(error: IntegrationError): { code: string; message: string } {
  let code = error.status ? String(error.status) : 'unknown';
  let message = error.message;
  const body = error.body;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    // Resend errors: { name: '…', message: '…', statusCode: N }.
    if (typeof obj.name === 'string') code = obj.name;
    if (typeof obj.message === 'string' && obj.message.trim()) message = obj.message.trim();
  }
  return { code, message };
}
