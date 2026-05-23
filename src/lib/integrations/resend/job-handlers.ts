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
import { renderEmail, type EmailRenderContext } from '@/lib/email/templates';
import {
  composeReplyToAddress,
  generateThreadToken,
} from '@/lib/email/threading';
import type { IntegrationError } from '@/lib/integrations/_shared/call';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
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
import { getTemplate } from './templates';
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
  const template = await loadTemplate(clientId, templateKey);
  const context = await buildRenderContext(clientId, sender, payload);
  const rendered = renderEmail(template, context);
  if (!rendered.subject && !rendered.text && !rendered.html) {
    await recordFailedSend(sender, payload, '', '', '', {
      code: 'empty_body',
      message: 'The rendered email had no subject + no body.',
    });
    return { sent: false, reason: 'empty-body' };
  }

  // --- threading ------------------------------------------------------------
  // Only outbound emails to a known lead carry a reply-to thread token —
  // operator notifications and the digest go to operators (who reply to us
  // out-of-band) and don't need an inbound routing token.
  const threadToken =
    payload.relatedLeadId && isCustomerFacingTemplate(templateKey)
      ? generateThreadToken(payload.relatedLeadId)
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
    text: rendered.text,
    html: rendered.html,
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
      body_text: rendered.text,
      body_html: rendered.html,
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
    rendered.text,
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

async function loadTemplate(
  clientId: string,
  key: EmailTemplateKey,
): Promise<EmailTemplateBody> {
  const row = await getTemplate(clientId, key);
  if (row) {
    return {
      subject: row.subject,
      body_html: row.body_html,
      body_text: row.body_text,
    };
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
    .select('name, primary_contact_phone, slug')
    .eq('id', clientId)
    .maybeSingle();
  const client = clientRow as
    | { name?: string; primary_contact_phone?: string | null; slug?: string }
    | null;

  const baseUrl = getAppBaseUrl();
  const inboxLink = baseUrl ? `${baseUrl}/leads` : '/leads';

  const ctx: EmailRenderContext = {
    'client.shortName': sender.display_name || client?.name || 'Webnua',
    'client.businessName': client?.name ?? '',
    'client.phone': client?.primary_contact_phone ?? '',
    'client.responseTime': '1 hour',
    'lead.firstName': payload.recipientName?.split(/\s+/)[0] ?? 'there',
    'lead.lastNameSuffix': '',
    'lead.fullName': payload.recipientName ?? '',
    'lead.email': '',
    'lead.phone': '',
    'lead.service': 'your enquiry',
    'lead.preview': '',
    'review.link': baseUrl ? `${baseUrl}/reviews` : '',
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

  return { ...ctx, ...(payload.contextOverrides ?? {}) };
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

function serviceFromEvents(
  events: { kind: string; payload: unknown }[],
): string | null {
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
