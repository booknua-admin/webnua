// =============================================================================
// Resend API client — the typed wrapper for every Resend call.
//
// Phase 7 Resend session. Every Resend HTTP call goes through callExternal()
// so it gets timeout, 5xx / network retry, error classification, and
// integration_call_log logging — same pattern as the Twilio / Stripe clients.
//
//   sendEmail   — POST /emails. Returns the Resend message id (re_…).
//   getMessage  — GET /emails/{id}. Used to look up delivery state when a
//                 caller needs the current status (the inbound-delivery
//                 webhook is the primary path — this is a fallback).
//
// PRODUCTION SWAP — Resend credentials. Development can use Resend's
// TEST-mode key (deliveries land in the Resend dashboard, NOT real mailboxes);
// production swaps RESEND_API_KEY to the live value. No code change.
//
// SERVER-ONLY — reads RESEND_API_KEY. Never import from client code.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal, type IntegrationResult } from '@/lib/integrations/_shared/call';

import type { ResendMessageResource, ResendSendResponse } from './types';

const RESEND_API = 'https://api.resend.com';

/** True when email sending can run — the API key is set. */
export function isResendConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/** True when the delivery-status webhook can verify a payload — the webhook
 *  secret is set. */
export function isInboundWebhookConfigured(): boolean {
  return Boolean(env.RESEND_WEBHOOK_SECRET);
}

/** Secret used to verify inbound `email.received` webhook payloads. Prefers
 *  the dedicated RESEND_INBOUND_WEBHOOK_SECRET, falls back to
 *  RESEND_WEBHOOK_SECRET when only one Resend webhook covers both URLs. */
export function getInboundEmailSecret(): string | null {
  return env.RESEND_INBOUND_WEBHOOK_SECRET || env.RESEND_WEBHOOK_SECRET || null;
}

/** True when the inbound email webhook can verify a payload — either secret
 *  is set. */
export function isInboundEmailWebhookConfigured(): boolean {
  return Boolean(getInboundEmailSecret());
}

function authHeader(): string | null {
  const key = env.RESEND_API_KEY;
  return key ? `Bearer ${key}` : null;
}

function notConfigured<T>(operation: string): IntegrationResult<T> {
  return {
    ok: false,
    error: {
      class: 'non_retryable',
      message: 'Resend is not configured (RESEND_API_KEY unset).',
      provider: 'resend',
      operation,
    },
  };
}

export type SendEmailInput = {
  /** Tenant attribution for the call-log row. */
  clientId?: string | null;
  /** Full "Display Name <local@domain>" or a bare address. */
  from: string;
  to: string | string[];
  /** Reply-To header — the plus-addressed thread token for inbound replies. */
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  /** RFC 2822 In-Reply-To — set when this outbound is itself a reply, so
   *  mail clients thread the conversation correctly. */
  inReplyTo?: string;
  /** Extra headers Resend will include verbatim. */
  headers?: Record<string, string>;
  /** Inline attachments. Content is base64-encoded; `path` is an alternative
   *  Resend accepts (a public URL it fetches at send time). */
  attachments?: {
    filename: string;
    content?: string;
    content_type?: string;
    path?: string;
  }[];
  /** Trace id linking this call to its siblings. */
  correlationId?: string;
};

/** Send one transactional email through Resend. */
export function sendEmail(
  input: SendEmailInput,
): Promise<IntegrationResult<ResendSendResponse>> {
  const auth = authHeader();
  if (!auth) return Promise.resolve(notConfigured('send_email'));

  const headers: Record<string, string> = { Authorization: auth };

  // Resend takes the In-Reply-To / References as JSON keys OR as a `headers`
  // map — passing it through the `headers` map matches RFC 2822 exactly and
  // avoids guessing per-API-version field names.
  const extraHeaders: Record<string, string> = { ...(input.headers ?? {}) };
  if (input.inReplyTo) {
    extraHeaders['In-Reply-To'] = input.inReplyTo;
    extraHeaders.References = input.inReplyTo;
  }

  const body: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    subject: input.subject,
  };
  if (input.text) body.text = input.text;
  if (input.html) body.html = input.html;
  if (input.replyTo) body.reply_to = input.replyTo;
  if (Object.keys(extraHeaders).length > 0) body.headers = extraHeaders;
  if (input.attachments && input.attachments.length > 0) {
    body.attachments = input.attachments;
  }

  return callExternal<ResendSendResponse>({
    provider: 'resend',
    operation: 'send_email',
    url: `${RESEND_API}/emails`,
    method: 'POST',
    headers,
    body,
    clientId: input.clientId ?? null,
    correlationId: input.correlationId,
  });
}

/** Read a Resend message resource back by id — fallback delivery-status
 *  lookup. The inbound webhook is the primary update path. */
export function getMessage(
  messageId: string,
  clientId?: string | null,
): Promise<IntegrationResult<ResendMessageResource>> {
  const auth = authHeader();
  if (!auth) return Promise.resolve(notConfigured('get_message'));
  return callExternal<ResendMessageResource>({
    provider: 'resend',
    operation: 'get_message',
    url: `${RESEND_API}/emails/${encodeURIComponent(messageId)}`,
    method: 'GET',
    headers: { Authorization: auth },
    clientId: clientId ?? null,
  });
}

/** Map Resend's delivery webhook event type (`email.sent` / `email.delivered`
 *  / `email.bounced` / `email.complained` / `email.delivery_delayed`) to our
 *  email_messages.status. */
export function mapResendEventToStatus(
  event: string,
):
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'
  | null {
  switch (event) {
    case 'email.sent':
      return 'sent';
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.delivery_delayed':
      // Still in flight — leave the row's current status alone. Returning
      // null tells the webhook handler "do not update".
      return null;
    case 'email.failed':
      return 'failed';
    default:
      return null;
  }
}
