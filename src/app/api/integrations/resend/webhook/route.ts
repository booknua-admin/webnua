// =============================================================================
// POST /api/integrations/resend/webhook — Resend delivery status webhook.
//
// Phase 7 Resend session. Resend POSTs delivery events here as an outbound
// email moves through its lifecycle: email.sent → email.delivered, or
// email.bounced / email.complained / email.failed. Authenticated by Svix
// signature against RESEND_WEBHOOK_SECRET.
//
// Distinct from the inbound webhook (which receives whole emails). Both share
// the same signing secret — Resend's dashboard configures a single endpoint
// for both, with the JSON `type` field discriminating. For clarity we host
// them on separate routes; the inbound route discriminates on type ===
// 'email.received', this one handles everything else.
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import {
  isInboundWebhookConfigured,
  mapResendEventToStatus,
} from '@/lib/integrations/resend/client';
import { updateStatusByResendId } from '@/lib/integrations/resend/messages';
import { verifyResendWebhook } from '@/lib/integrations/resend/webhook-verify';

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
        provider: 'resend',
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
      console.warn('[resend/webhook] call-log write failed', error);
    }
  })();
}

export async function POST(request: Request): Promise<Response> {
  if (!isInboundWebhookConfigured()) {
    return NextResponse.json({ error: 'resend-webhook-not-configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const verify = verifyResendWebhook(
    rawBody,
    request.headers,
    env.RESEND_WEBHOOK_SECRET as string,
  );
  if (!verify.ok) {
    logInbound(
      'delivery_status',
      null,
      { reason: verify.reason },
      400,
      'auth_failed',
      `verify: ${verify.reason}`,
    );
    return NextResponse.json({ error: 'invalid-signature' }, { status: 400 });
  }

  let payload: { type?: string; data?: { id?: string; email_id?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logInbound('delivery_status', null, { reason: 'bad-json' }, 200, null, 'bad-json');
    return NextResponse.json({ received: true });
  }

  const eventType = payload.type ?? '';
  if (eventType === 'email.received') {
    // Inbound emails are handled by the inbound route; ignore here.
    return NextResponse.json({ received: true });
  }

  const status = mapResendEventToStatus(eventType);
  if (!status) {
    // email.delivery_delayed or an event type we don't track — note it and
    // return 200.
    logInbound(
      'delivery_status',
      null,
      { type: eventType },
      200,
      null,
      'unmapped-event',
    );
    return NextResponse.json({ received: true });
  }

  const resendId = payload.data?.id ?? payload.data?.email_id;
  if (!resendId) {
    logInbound(
      'delivery_status',
      null,
      { type: eventType, reason: 'no-id' },
      200,
      null,
      'no-id',
    );
    return NextResponse.json({ received: true });
  }

  try {
    const result = await updateStatusByResendId(resendId, { status });
    logInbound(
      `delivery_status:${eventType}`,
      result.clientId,
      { resendId, status, found: result.updated },
      200,
      null,
      result.updated ? null : 'no-matching-message',
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[resend/webhook] handler error', message);
    logInbound(
      'delivery_status',
      null,
      { resendId, type: eventType },
      500,
      'non_retryable',
      message,
    );
    return NextResponse.json({ error: 'handler-failed' }, { status: 500 });
  }
}
