// =============================================================================
// POST /api/integrations/stripe/checkout — start billing for a client.
//
// Phase 7 Stripe billing session. Operator-only. The operator (in a client's
// sub-account billing settings) starts the €299/month subscription:
//   1. resolve or create the client's Stripe Customer + the
//      client_stripe_customers mapping row;
//   2. create a hosted Checkout Session for the standard subscription Price;
//   3. return the Checkout URL — the operator's browser navigates to it.
//
// Reached by fetch() with the operator's Supabase access token on the
// Authorization header (same auth transport as the OAuth integration routes).
// The body carries the client UUID.
//
// When the client completes (or abandons) Checkout, Stripe redirects back to
// /settings/billing and fires webhooks that update client_stripe_customers.
// =============================================================================

import { NextResponse } from 'next/server';

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  createCheckoutSession,
  createCustomer,
  isStripeConfigured,
} from '@/lib/integrations/stripe/client';
import {
  getStripeCustomerByClientId,
  insertStripeCustomer,
} from '@/lib/integrations/stripe/customers';

type ClientRow = {
  name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
};

/** Resolve a billing email for the Stripe Customer: the client's primary
 *  contact email, falling back to the client's owner (first client-role user). */
async function resolveBillingEmail(clientId: string, client: ClientRow): Promise<string | null> {
  if (client.primary_contact_email) return client.primary_contact_email;
  const { data } = await getIntegrationDb()
    .from('users')
    .select('email')
    .eq('client_id', clientId)
    .eq('role', 'client')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { email?: string } | null)?.email ?? null;
}

export async function POST(request: Request): Promise<Response> {
  let clientId: unknown;
  try {
    ({ clientId } = (await request.json()) as { clientId?: unknown });
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'stripe-not-configured' }, { status: 503 });
  }

  // --- resolve / create the Stripe Customer ---------------------------------
  let record = await getStripeCustomerByClientId(clientId);

  // A client already on an active or past_due subscription must not start a
  // second one — they manage the existing one through the Stripe portal.
  if (record && (record.status === 'active' || record.status === 'past_due')) {
    return NextResponse.json({ error: 'already-subscribed' }, { status: 409 });
  }

  if (!record) {
    const { data: clientData } = await getIntegrationDb()
      .from('clients')
      .select('name, primary_contact_name, primary_contact_email')
      .eq('id', clientId)
      .maybeSingle();
    const client = clientData as ClientRow | null;
    if (!client) {
      return NextResponse.json({ error: 'client-not-found' }, { status: 404 });
    }
    const email = await resolveBillingEmail(clientId, client);
    if (!email) {
      return NextResponse.json({ error: 'no-billing-email' }, { status: 400 });
    }
    const name = client.primary_contact_name ?? client.name;

    const created = await createCustomer(clientId, email, name);
    if (!created.ok) {
      console.error('[stripe/checkout] createCustomer failed', created.error.message);
      return NextResponse.json(
        { error: 'stripe-customer-failed', detail: created.error.message },
        { status: 502 },
      );
    }
    record = await insertStripeCustomer(clientId, created.data.id);
  }

  // --- create the Checkout Session ------------------------------------------
  const origin = new URL(request.url).origin;
  const session = await createCheckoutSession({
    clientId,
    stripeCustomerId: record.stripe_customer_id,
    successUrl: `${origin}/settings/billing?stripe=success`,
    cancelUrl: `${origin}/settings/billing?stripe=cancelled`,
  });
  if (!session.ok || !session.data.url) {
    const detail = session.ok ? 'Checkout session returned no URL' : session.error.message;
    console.error('[stripe/checkout] createCheckoutSession failed', detail);
    return NextResponse.json({ error: 'stripe-checkout-failed', detail }, { status: 502 });
  }

  return NextResponse.json({ checkoutUrl: session.data.url });
}
