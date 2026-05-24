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

import {
  hasProvisionedWorkspace,
  provisionSignupWorkspace,
} from '@/lib/auth/signup-workspace';
import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { firePaymentFailed } from '@/lib/automations/triggers';
import {
  applyInvoiceFailed,
  applyInvoicePaid,
  applySubscriptionEvent,
} from '@/lib/integrations/stripe/customers';
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

/** A subscription created by the /api/sign-up flow carries our `kind=signup`
 *  metadata + the captured business details. The handler reads from the
 *  subscription's own metadata (set via `subscription_data.metadata` at
 *  Checkout-session creation) so the data flows through `subscription.created`
 *  directly without a second round-trip to fetch the session. */
type SignupMetadata = {
  kind?: string;
  signup_business_name?: string;
  signup_business_email?: string;
  signup_business_category?: string;
};

function readSignupMetadata(sub: StripeSubscription): SignupMetadata | null {
  const meta = (sub as unknown as { metadata?: SignupMetadata }).metadata;
  if (!meta || meta.kind !== 'signup') return null;
  return meta;
}

/** Apply one verified event. Returns the resolved tenant (for the call-log
 *  row) or null when the event refers to a customer we do not track. */
async function handleEvent(event: StripeEvent): Promise<{ clientId: string | null }> {
  const object = event.data.object;
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = object as unknown as StripeSubscription;

      // SIGNUP PROVISIONING. A subscription stamped with our `kind=signup`
      // metadata is the trigger to create a brand-new workspace. We guard
      // on `hasProvisionedWorkspace(sub.customer)` so a webhook retry (or a
      // late `.updated` event for an already-signed-up customer) does not
      // create a second workspace. The check is the unique-row anchor on
      // `client_stripe_customers.stripe_customer_id`.
      const signup = event.type === 'customer.subscription.created' ? readSignupMetadata(sub) : null;
      if (signup) {
        const already = await hasProvisionedWorkspace(sub.customer);
        if (!already) {
          try {
            await provisionSignupWorkspace({
              businessName: signup.signup_business_name ?? '',
              businessEmail: signup.signup_business_email ?? '',
              businessCategory: signup.signup_business_category ?? '',
              stripeCustomerId: sub.customer,
            });
          } catch (error) {
            // Provisioning failed AFTER the customer paid. Log loudly and
            // continue to apply the subscription event — the operator can
            // resolve manually from Stripe + our logs. Returning 500 to
            // Stripe would trigger retries that hit the same error.
            const message = error instanceof Error ? error.message : String(error);
            console.error('[stripe/webhook] signup workspace provisioning failed', message);
          }
        }
        // FALL THROUGH to applySubscriptionEvent below — the row we just
        // (or someone before us) inserted is 'incomplete'; this same event
        // body flips it to 'active'.
      }

      const result = await applySubscriptionEvent(sub, { deleted: false });
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
        // Phase 8 Session 1 — orchestrated through the automation engine. The
        // payment_failed_notification automation (seeded by 0077) has one
        // send_operator_notification action with variant=payment_failed; the
        // action handler enqueues the existing STRIPE_PAYMENT_FAILED_JOB so
        // the email-sending code is unchanged.
        await firePaymentFailed(result.clientId, { invoiceId: invoice.id });
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
