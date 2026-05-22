// =============================================================================
// POST /api/integrations/stripe/webhook — Stripe webhook handler.
//
// Phase 7 Stripe billing session. Stripe calls this on subscription / invoice
// events. The request is authenticated by its signature (verified against
// STRIPE_WEBHOOK_SECRET) — there is no bearer token, the caller is Stripe.
//
// Handled events:
//   • customer.subscription.created / .updated → mirror status + period end +
//     price onto client_stripe_customers.
//   • customer.subscription.deleted            → status 'cancelled'.
//   • invoice.payment_succeeded                → record the payment, clear any
//                                                past_due posture.
//   • invoice.payment_failed                   → status 'past_due'; enqueue the
//                                                operator-notification job.
// Every other event type is acknowledged (200) and ignored.
//
// Every verified event — and every rejected delivery — is written to
// integration_call_log with direction='inbound'.
//
// Response policy: 200 once the event is verified and applied (including the
// "we do not track this customer" no-op — returning non-200 would make Stripe
// retry forever). 400 on a signature failure. 500 on a genuine processing
// error (a transient DB fault) so Stripe retries and the state self-heals.
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import {
  applyInvoiceFailed,
  applyInvoicePaid,
  applySubscriptionEvent,
} from '@/lib/integrations/stripe/customers';
import { STRIPE_PAYMENT_FAILED_JOB } from '@/lib/integrations/stripe/job-types';
import type {
  StripeEvent,
  StripeInvoice,
  StripeSubscription,
} from '@/lib/integrations/stripe/types';
import { verifyStripeWebhook } from '@/lib/integrations/stripe/webhook-verify';

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
        provider: 'stripe',
        operation,
        direction: 'inbound',
        request_shape: requestShape,
        response_status: responseStatus,
        response_shape: null,
        latency_ms: null,
        error_class: errorClass,
        error_message: errorMessage,
        client_id: clientId,
        // correlation_id is a uuid column; a Stripe evt_ id is not a uuid, so
        // it rides on request_shape instead.
        correlation_id: null,
      });
    } catch (error) {
      console.warn('[stripe/webhook] call-log write failed', error);
    }
  })();
}

/** Apply one verified event. Returns the resolved tenant (for the call-log
 *  row) or null when the event refers to a customer we do not track. */
async function handleEvent(event: StripeEvent): Promise<{ clientId: string | null }> {
  const object = event.data.object;
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const result = await applySubscriptionEvent(object as unknown as StripeSubscription, {
        deleted: false,
      });
      return { clientId: result.clientId };
    }
    case 'customer.subscription.deleted': {
      const result = await applySubscriptionEvent(object as unknown as StripeSubscription, {
        deleted: true,
      });
      return { clientId: result.clientId };
    }
    case 'invoice.payment_succeeded': {
      const result = await applyInvoicePaid(object as unknown as StripeInvoice);
      return { clientId: result.clientId };
    }
    case 'invoice.payment_failed': {
      const invoice = object as unknown as StripeInvoice;
      const result = await applyInvoiceFailed(invoice);
      if (result.outcome === 'applied' && result.clientId) {
        // Notify the operator(s) — fast path via immediate dispatch, with the
        // pg_cron poller as the fallback.
        await enqueueJobImmediate(
          STRIPE_PAYMENT_FAILED_JOB,
          { clientId: result.clientId, invoiceId: invoice.id },
          { provider: 'stripe', clientId: result.clientId },
        );
      }
      return { clientId: result.clientId };
    }
    default:
      // Acknowledged but not acted on.
      return { clientId: null };
  }
}

export async function POST(request: Request): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Cannot verify the caller — refuse rather than process unauthenticated.
    return NextResponse.json({ error: 'stripe-webhook-not-configured' }, { status: 503 });
  }

  // The raw body is required for signature verification — read it before any
  // JSON parsing (App Router does not pre-parse the body).
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  const verified = verifyStripeWebhook(rawBody, signature, secret);
  if (!verified.ok) {
    logInbound('webhook', null, { reason: verified.reason }, 400, 'auth_failed', verified.reason);
    return NextResponse.json(
      { error: 'invalid-signature', reason: verified.reason },
      { status: 400 },
    );
  }

  const event = verified.event;
  const shape = { id: event.id, type: event.type };
  try {
    const { clientId } = await handleEvent(event);
    logInbound(event.type, clientId, shape, 200, null, null);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe/webhook] handler error', event.type, message);
    logInbound(event.type, null, shape, 500, 'non_retryable', message);
    // 500 → Stripe retries the delivery; a transient fault then self-heals.
    return NextResponse.json({ error: 'handler-failed' }, { status: 500 });
  }
}
