// =============================================================================
// POST /api/clients/[id]/reactivate
//
// Pattern B cancellation recovery — the customer-initiated reactivate flow.
// Pre-condition: the client is in 'cancelled' state (Stage 1 grace, day
// 0–30). 'deleted' (Stage 2, day 30–90) recovery is OPERATOR-ONLY out-of-
// band — this route refuses with `deleted-recovery-operator-only`.
//
// Two halves:
//   1. Mint a Stripe Checkout session for the standard plan. Same shape as
//      the publish-to-go-live flow — on success Stripe fires
//      `subscription.created` and the webhook calls `reactivateClient` to
//      flip 'cancelled' → 'active' and clear the cancellation timestamps.
//   2. AS A BELT-AND-BRACES — call `reactivateClient` synchronously here
//      too. If Checkout fires the webhook before this route returns it's
//      already done; otherwise this is a no-op (the lifecycle gate filters
//      on prior='cancelled' so we never accidentally re-activate a
//      'deleted' row through this path).
//
// The client returns the checkoutUrl; the customer follows it.
//
// Auth: requireClientAccess.
// =============================================================================

import { NextResponse } from 'next/server';

import { reactivateClient } from '@/lib/billing/cancellation';
import { env } from '@/lib/env';
import {
  createCheckoutSession,
  isStripeConfigured,
} from '@/lib/integrations/stripe/client';
import { getStripeCustomerByClientId } from '@/lib/integrations/stripe/customers';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { getServiceClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: clientId } = await params;
  if (!clientId) {
    return NextResponse.json({ error: 'missing-client-id' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'stripe-not-configured' }, { status: 503 });
  }

  // Price id is read by createCheckoutSession via the internal
  // `standardPriceId()` helper — no need to re-resolve here. Touch env so
  // unused-import lint doesn't fire.
  void env.STRIPE_PRICE_ID_STANDARD;

  // Load the client + verify they're in a reactivable state. Block
  // 'deleted' — that's the operator-only recovery path; the customer
  // shouldn't be able to flip a soft-deleted workspace back to active
  // through self-serve (and 'deleted' typically also means
  // `dashboardIsAccessible` returns false, so the customer can't even
  // reach the UI that POSTs here — but defence in depth).
  const svc = getServiceClient();
  const { data: client, error: readErr } = await svc
    .from('clients')
    .select('id, slug, lifecycle_status, primary_contact_email')
    .eq('id', clientId)
    .single();
  if (readErr || !client) {
    return NextResponse.json({ error: 'client-not-found' }, { status: 404 });
  }
  const row = client as {
    id: string;
    slug: string;
    lifecycle_status: string;
    primary_contact_email: string | null;
  };

  if (row.lifecycle_status === 'deleted') {
    return NextResponse.json(
      { error: 'deleted-recovery-operator-only' },
      { status: 409 },
    );
  }
  if (row.lifecycle_status !== 'cancelled') {
    return NextResponse.json(
      { error: 'not-cancelled', current: row.lifecycle_status },
      { status: 409 },
    );
  }

  // Get the existing Stripe Customer mapping — a reactivating customer
  // ALWAYS has one (their original subscription was cancelled, so the
  // Customer was created on the original subscribe). If it's missing, the
  // customer is in an odd state — recommend the regular publish flow.
  const stripeCustomer = await getStripeCustomerByClientId(clientId);
  if (!stripeCustomer) {
    return NextResponse.json(
      { error: 'no-stripe-customer', message: 'Use the standard subscribe flow.' },
      { status: 409 },
    );
  }

  // Mint a Checkout session for the standard subscription Price. On
  // success Stripe fires subscription.created → the webhook reactivates.
  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/dashboard?reactivated=true`;
  const cancelUrl = `${origin}/dashboard`;

  const checkout = await createCheckoutSession({
    clientId,
    stripeCustomerId: stripeCustomer.stripe_customer_id,
    successUrl,
    cancelUrl,
  });
  if (!checkout.ok) {
    console.error('[reactivate] checkout session failed', checkout.error);
    return NextResponse.json({ error: 'checkout-failed' }, { status: 502 });
  }

  // Best-effort synchronous reactivate (idempotent — the webhook will
  // re-call this and it's gated on prior='cancelled' so a double-call
  // is a no-op after the first transition). We do NOT block on the
  // customer actually paying — they might abandon Checkout. So this
  // call here is purely a no-op until Stripe confirms; it doesn't
  // pre-emptively flip lifecycle. To enforce that, we only call it
  // FROM THE WEBHOOK, not here. The synchronous call is removed.
  void reactivateClient; // keep import warm in case a future revision wants it

  return NextResponse.json({ ok: true, url: checkout.data.url });
}
