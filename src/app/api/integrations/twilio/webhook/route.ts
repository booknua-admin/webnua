// =============================================================================
// POST /api/integrations/twilio/webhook — Twilio SMS status callback.
//
// Phase 7 Twilio SMS session. Twilio POSTs here as a message moves through its
// delivery lifecycle (queued → sent → delivered, or failed / undelivered).
// The request is authenticated by its X-Twilio-Signature header (verified
// against TWILIO_AUTH_TOKEN) — there is no bearer token, the caller is Twilio.
//
// The body is application/x-www-form-urlencoded; the row is found by
// MessageSid and its status (+ any ErrorCode) is updated.
//
// Every delivery — and every rejected delivery — is written to
// integration_call_log with direction='inbound'.
//
// Response policy: 200 once the signature is verified and the update applied
// (including the "no row for this SID" no-op — returning non-200 would make
// Twilio retry forever). 400 on a signature failure. 503 when unconfigured.
// 500 on a genuine processing error (a transient DB fault) so Twilio retries
// and the state self-heals.
// =============================================================================

import { NextResponse } from 'next/server';

import { env, getAppBaseUrl } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { mapTwilioMessageStatus } from '@/lib/integrations/twilio/client';
import { updateStatusByTwilioSid } from '@/lib/integrations/twilio/messages';
import { verifyTwilioSignature } from '@/lib/integrations/twilio/webhook-verify';

/** Write one inbound-webhook row to integration_call_log. Fire-and-forget —
 *  observability must not block or fail the webhook response. */
function logInbound(
  operation: string,
  clientId: string | null,
  requestShape: unknown,
  responseStatus: number,
  errorClass: 'auth_failed' | 'non_retryable' | null,
  errorMessage: string | null,
): void {
  void (async () => {
    try {
      await getIntegrationDb().from('integration_call_log').insert({
        provider: 'twilio',
        operation,
        direction: 'inbound',
        request_shape: requestShape,
        response_status: responseStatus,
        response_shape: null,
        latency_ms: null,
        error_class: errorClass,
        error_message: errorMessage,
        client_id: clientId,
        correlation_id: null,
      });
    } catch (error) {
      console.warn('[twilio/webhook] call-log write failed', error);
    }
  })();
}

export async function POST(request: Request): Promise<Response> {
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    // Cannot verify the caller — refuse rather than process unauthenticated.
    return NextResponse.json({ error: 'twilio-webhook-not-configured' }, { status: 503 });
  }

  // Twilio webhooks are form-encoded — read the raw body, parse the params.
  const rawBody = await request.text();
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) {
    params[key] = value;
  }
  const signature = request.headers.get('x-twilio-signature');

  // Verify against the URL Twilio was configured to call (the StatusCallback
  // we passed on send), with the raw request URL as a fallback for proxy /
  // trailing-slash differences.
  const base = getAppBaseUrl();
  const configuredUrl = base ? `${base}/api/integrations/twilio/webhook` : null;
  const verified =
    (configuredUrl && verifyTwilioSignature(configuredUrl, params, signature, authToken).ok) ||
    verifyTwilioSignature(request.url, params, signature, authToken).ok;

  if (!verified) {
    logInbound(
      'status_callback',
      null,
      { reason: 'signature' },
      400,
      'auth_failed',
      'bad-signature',
    );
    return NextResponse.json({ error: 'invalid-signature' }, { status: 400 });
  }

  // Twilio carries the message id as MessageSid (SmsSid on older payloads) and
  // the status as MessageStatus (SmsStatus).
  const messageSid = params.MessageSid || params.SmsSid || '';
  const twilioStatus = params.MessageStatus || params.SmsStatus || '';
  if (!messageSid || !twilioStatus) {
    logInbound('status_callback', null, params, 200, null, 'missing-sid-or-status');
    return NextResponse.json({ received: true });
  }

  try {
    const status = mapTwilioMessageStatus(twilioStatus);
    const errorCode = params.ErrorCode ? params.ErrorCode : null;
    const result = await updateStatusByTwilioSid(messageSid, {
      status,
      errorCode,
      // Twilio's callback carries a numeric ErrorCode but no message text;
      // a code with no row-side message is still actionable.
      errorMessage: errorCode ? `Twilio error code ${errorCode}` : null,
    });
    logInbound(
      `status_callback:${twilioStatus}`,
      result.clientId,
      { messageSid, status: twilioStatus, errorCode },
      200,
      null,
      result.updated ? null : 'no-matching-message',
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[twilio/webhook] handler error', message);
    logInbound('status_callback', null, { messageSid }, 500, 'non_retryable', message);
    // 500 → Twilio retries the delivery; a transient fault then self-heals.
    return NextResponse.json({ error: 'handler-failed' }, { status: 500 });
  }
}
