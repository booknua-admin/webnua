// =============================================================================
// Twilio API client — the typed wrapper for every Twilio call.
//
// Phase 7 Twilio SMS session. Every Twilio HTTP call goes through
// callExternal() so it gets timeout, 5xx / network retry, error
// classification and integration_call_log logging — same pattern as the
// Stripe client and lib/website/vercel.ts.
//
// Twilio's REST API takes application/x-www-form-urlencoded request bodies
// and returns JSON; callExternal's `rawBody` escape hatch carries the form
// body. Auth is HTTP Basic — Account SID as the username, Auth Token as the
// password.
//
//   registerSenderID  — adds the alphanumeric string to Webnua's Twilio
//                       Messaging Service as an AlphaSender resource.
//   getSenderIDStatus — reads an AlphaSender resource back (the status poll).
//   sendSMS           — sends one one-way SMS from an alphanumeric sender.
//
// PRODUCTION SWAP — Twilio credentials. Development uses Twilio TEST-mode
// credentials; production swaps TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN to the
// live values. No code change — the mode is purely which credentials are set.
// Alphanumeric senders are NOT usable with test credentials; the AlphaSender
// API + real sends need a live (or trial) account. See CLAUDE.md.
//
// SERVER-ONLY — reads TWILIO_AUTH_TOKEN. Never import from client code.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal, type IntegrationResult } from '@/lib/integrations/_shared/call';

import type { TwilioAlphaSenderResource, TwilioMessageResource } from './types';

const MESSAGING_API = 'https://messaging.twilio.com/v1';
const ACCOUNTS_API = 'https://api.twilio.com/2010-04-01';

// --- configuration -----------------------------------------------------------

/** True when SMS sending can run — the account credentials are both set. */
export function isTwilioConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
}

/** True when sender-id registration can run — sending plus a Messaging
 *  Service to register the alphanumeric sender against. */
export function isSenderRegistrationConfigured(): boolean {
  return isTwilioConfigured() && Boolean(env.TWILIO_MESSAGING_SERVICE_SID);
}

// --- the call wrapper --------------------------------------------------------

/** HTTP Basic auth header for the Twilio REST API. */
function authHeader(): string | null {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

/** A not-configured IntegrationResult — returned without making a call. */
function notConfigured<T>(operation: string): IntegrationResult<T> {
  return {
    ok: false,
    error: {
      class: 'non_retryable',
      message: 'Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN unset).',
      provider: 'twilio',
      operation,
    },
  };
}

type TwilioCallOptions = {
  operation: string;
  method: 'GET' | 'POST';
  url: string;
  /** Flat form params for a POST. */
  params?: Record<string, string>;
  clientId?: string | null;
};

async function twilioCall<T>(options: TwilioCallOptions): Promise<IntegrationResult<T>> {
  const auth = authHeader();
  if (!auth) return notConfigured<T>(options.operation);

  const headers: Record<string, string> = { Authorization: auth };
  let rawBody: string | undefined;
  if (options.method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    rawBody = new URLSearchParams(options.params ?? {}).toString();
  }

  return callExternal<T>({
    provider: 'twilio',
    operation: options.operation,
    url: options.url,
    method: options.method,
    headers,
    rawBody,
    clientId: options.clientId ?? null,
  });
}

// --- public API --------------------------------------------------------------

/**
 * Register an alphanumeric sender id. Adds the string to Webnua's Twilio
 * Messaging Service as an AlphaSender resource — the resource's SID is the
 * "registration id" the caller stores and later polls with
 * getSenderIDStatus().
 *
 * Note: adding the AlphaSender makes it usable for sends in non-regulated
 * destination countries immediately. Regulated countries additionally require
 * a Sender ID registration completed in the Twilio Console (typically 1–3
 * business days) — see CLAUDE.md "Twilio SMS — operator setup".
 */
export function registerSenderID(
  clientId: string,
  senderId: string,
): Promise<IntegrationResult<TwilioAlphaSenderResource>> {
  const serviceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  if (!serviceSid) return Promise.resolve(notConfigured('register_sender_id'));
  return twilioCall<TwilioAlphaSenderResource>({
    operation: 'register_sender_id',
    method: 'POST',
    url: `${MESSAGING_API}/Services/${encodeURIComponent(serviceSid)}/AlphaSenders`,
    params: { AlphaSender: senderId },
    clientId,
  });
}

/** Read an AlphaSender resource back by its SID — the status poll. */
export function getSenderIDStatus(
  registrationId: string,
  clientId?: string | null,
): Promise<IntegrationResult<TwilioAlphaSenderResource>> {
  const serviceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  if (!serviceSid) return Promise.resolve(notConfigured('get_sender_id_status'));
  return twilioCall<TwilioAlphaSenderResource>({
    operation: 'get_sender_id_status',
    method: 'GET',
    url: `${MESSAGING_API}/Services/${encodeURIComponent(serviceSid)}/AlphaSenders/${encodeURIComponent(registrationId)}`,
    clientId: clientId ?? null,
  });
}

export type SendSmsOptions = {
  /** Tenant attribution for the call-log row. */
  clientId?: string | null;
  /** Delivery status-callback URL — Twilio POSTs status updates here. */
  statusCallback?: string;
};

/**
 * Send one SMS from an alphanumeric sender id. Alphanumeric senders are
 * one-way — the recipient cannot reply.
 */
export function sendSMS(
  senderId: string,
  recipientPhone: string,
  message: string,
  options: SendSmsOptions = {},
): Promise<IntegrationResult<TwilioMessageResource>> {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  if (!accountSid) return Promise.resolve(notConfigured('send_sms'));

  const params: Record<string, string> = {
    From: senderId,
    To: recipientPhone,
    Body: message,
  };
  if (options.statusCallback) params.StatusCallback = options.statusCallback;

  return twilioCall<TwilioMessageResource>({
    operation: 'send_sms',
    method: 'POST',
    url: `${ACCOUNTS_API}/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    params,
    clientId: options.clientId ?? null,
  });
}

/** Map Twilio's message-status enum onto our five-value sms_messages status. */
export function mapTwilioMessageStatus(
  twilioStatus: string,
): 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered' {
  switch (twilioStatus) {
    case 'delivered':
      return 'delivered';
    case 'sent':
      return 'sent';
    case 'undelivered':
      return 'undelivered';
    case 'failed':
      return 'failed';
    // accepted / queued / sending / scheduled — still in flight.
    default:
      return 'queued';
  }
}
