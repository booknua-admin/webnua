// =============================================================================
// Stripe API client — the typed wrapper for every Stripe call.
//
// Phase 7 Stripe billing session. Every Stripe HTTP call goes through
// callExternal() (the shared integration wrapper) so it gets timeout, 5xx /
// network retry, error classification, and integration_call_log logging for
// free — same pattern as lib/website/vercel.ts.
//
// Stripe's REST API takes application/x-www-form-urlencoded request bodies
// (with bracket nesting for nested params) and returns JSON. callExternal's
// `rawBody` escape hatch carries the form body; the JSON response is parsed by
// the default path.
//
// Idempotency: callExternal retries POSTs on 5xx / network errors, and Stripe
// mutations are not naturally idempotent — a retried createCustomer could
// create a duplicate. Every POST therefore carries an Idempotency-Key header.
// callExternal builds the header set ONCE and reuses it across a call's retry
// attempts, so the three attempts of one logical call share a key (Stripe
// dedups them) while a deliberate re-call gets a fresh key.
//
// PRODUCTION SWAP — Stripe keys.
// Development uses Stripe TEST-mode keys (sk_test_… secret key, a test-mode
// Price id in STRIPE_PRICE_ID_STANDARD, a test webhook secret). For production,
// swap STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PUBLISHABLE_KEY /
// STRIPE_PRICE_ID_STANDARD to the LIVE-mode values in the deployment env. No
// code change is needed — test vs live is entirely a function of which keys
// are set. See CLAUDE.md "Stripe billing — operator setup".
//
// SERVER-ONLY — reads STRIPE_SECRET_KEY. Never import from client code.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal, type IntegrationResult } from '@/lib/integrations/_shared/call';

import type {
  StripeCheckoutSession,
  StripeCustomer,
  StripePortalSession,
  StripeSubscription,
} from './types';

const API = 'https://api.stripe.com/v1';

// --- configuration -----------------------------------------------------------

/** True when Stripe billing can run — both the secret key and the standard
 *  Price id are set. Routes return a not-configured error otherwise. */
export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID_STANDARD);
}

/** The standard plan Price id (€299/month). */
export function standardPriceId(): string | null {
  return env.STRIPE_PRICE_ID_STANDARD ?? null;
}

// --- form encoding -----------------------------------------------------------

/** Recursively flatten a value into Stripe's bracket-notation form pairs:
 *  `{ items: [{ price: 'p' }] }` → `items[0][price]=p`. */
function encodeForm(value: unknown, prefix: string, pairs: string[]): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => encodeForm(item, `${prefix}[${i}]`, pairs));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      encodeForm(val, prefix ? `${prefix}[${key}]` : key, pairs);
    }
    return;
  }
  pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`);
}

function formBody(params: Record<string, unknown>): string {
  const pairs: string[] = [];
  encodeForm(params, '', pairs);
  return pairs.join('&');
}

// --- the call wrapper --------------------------------------------------------

type StripeCallOptions = {
  operation: string;
  method: 'GET' | 'POST' | 'DELETE';
  /** Path under /v1, e.g. '/customers'. */
  path: string;
  /** Form params for a POST. */
  params?: Record<string, unknown>;
  /** Tenant attribution for the call-log row. */
  clientId?: string | null;
};

async function stripeCall<T>(options: StripeCallOptions): Promise<IntegrationResult<T>> {
  const secretKey = env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      ok: false,
      error: {
        class: 'non_retryable',
        message: 'Stripe is not configured (STRIPE_SECRET_KEY is unset).',
        provider: 'stripe',
        operation: options.operation,
      },
    };
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}` };
  let rawBody: string | undefined;
  if (options.method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    // Fresh key per logical call; reused across this call's retry attempts.
    headers['Idempotency-Key'] = crypto.randomUUID();
    rawBody = formBody(options.params ?? {});
  }

  return callExternal<T>({
    provider: 'stripe',
    operation: options.operation,
    url: `${API}${options.path}`,
    method: options.method,
    headers,
    rawBody,
    clientId: options.clientId ?? null,
  });
}

// --- public API --------------------------------------------------------------

/** Create a Stripe Customer for a Webnua client. The client_id is stamped on
 *  the customer's metadata so Stripe objects are traceable back to the tenant. */
export function createCustomer(
  clientId: string,
  email: string,
  name: string,
): Promise<IntegrationResult<StripeCustomer>> {
  return stripeCall<StripeCustomer>({
    operation: 'create_customer',
    method: 'POST',
    path: '/customers',
    params: { email, name, metadata: { client_id: clientId } },
    clientId,
  });
}

/** Create a hosted Checkout Session for the standard €299/month subscription.
 *  The customer completes payment on Stripe's hosted page; the resulting
 *  subscription arrives back as a customer.subscription.created webhook. */
export function createCheckoutSession(input: {
  clientId: string;
  stripeCustomerId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<IntegrationResult<StripeCheckoutSession>> {
  return stripeCall<StripeCheckoutSession>({
    operation: 'create_checkout_session',
    method: 'POST',
    path: '/checkout/sessions',
    params: {
      mode: 'subscription',
      customer: input.stripeCustomerId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      line_items: [{ price: standardPriceId(), quantity: 1 }],
      metadata: { client_id: input.clientId },
      // Stamp the tenant on the subscription too, so the webhook can attribute
      // a subscription even if the customer-row lookup ever misses.
      subscription_data: { metadata: { client_id: input.clientId } },
    },
    clientId: input.clientId,
  });
}

/** Create a subscription directly (no hosted Checkout). The Webnua flow uses
 *  Checkout; this is here for programmatic / future use. */
export function createSubscription(
  stripeCustomerId: string,
  priceId: string,
  clientId?: string | null,
): Promise<IntegrationResult<StripeSubscription>> {
  return stripeCall<StripeSubscription>({
    operation: 'create_subscription',
    method: 'POST',
    path: '/subscriptions',
    params: { customer: stripeCustomerId, items: [{ price: priceId }] },
    clientId: clientId ?? null,
  });
}

/** Cancel a subscription. `atPeriodEnd: true` schedules cancellation at the
 *  end of the paid period (access runs out the period); `false` cancels
 *  immediately. */
export function cancelSubscription(
  subscriptionId: string,
  atPeriodEnd: boolean,
  clientId?: string | null,
): Promise<IntegrationResult<StripeSubscription>> {
  const path = `/subscriptions/${encodeURIComponent(subscriptionId)}`;
  if (atPeriodEnd) {
    return stripeCall<StripeSubscription>({
      operation: 'cancel_subscription_at_period_end',
      method: 'POST',
      path,
      params: { cancel_at_period_end: true },
      clientId: clientId ?? null,
    });
  }
  return stripeCall<StripeSubscription>({
    operation: 'cancel_subscription',
    method: 'DELETE',
    path,
    clientId: clientId ?? null,
  });
}

/** Retrieve a subscription — status, period end, cancellation flag. */
export function getSubscription(
  subscriptionId: string,
  clientId?: string | null,
): Promise<IntegrationResult<StripeSubscription>> {
  return stripeCall<StripeSubscription>({
    operation: 'get_subscription',
    method: 'GET',
    path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    clientId: clientId ?? null,
  });
}

/** Create a Stripe Billing Portal session — the hosted page where the customer
 *  updates their card, views invoices, or cancels. Requires the Customer
 *  Portal to be activated in the Stripe dashboard. */
export function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
  clientId?: string | null,
): Promise<IntegrationResult<StripePortalSession>> {
  return stripeCall<StripePortalSession>({
    operation: 'create_portal_session',
    method: 'POST',
    path: '/billing_portal/sessions',
    params: { customer: stripeCustomerId, return_url: returnUrl },
    clientId: clientId ?? null,
  });
}
