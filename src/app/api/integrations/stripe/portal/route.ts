// =============================================================================
// POST /api/integrations/stripe/portal — open the Stripe Customer Portal.
//
// Phase 7 Stripe billing session. Operator-only. For a client that already
// has a Stripe Customer, this mints a Billing Portal session — the hosted
// Stripe page where the customer updates their payment method, views invoices,
// or cancels the subscription.
//
// Reached by fetch() with the operator's Supabase access token; the body
// carries the client UUID. Returns the portal URL for the browser to navigate
// to. The Customer Portal must be activated once in the Stripe dashboard
// (Settings → Billing → Customer portal) — see CLAUDE.md.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { createPortalSession, isStripeConfigured } from '@/lib/integrations/stripe/client';
import { getStripeCustomerByClientId } from '@/lib/integrations/stripe/customers';

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

  const record = await getStripeCustomerByClientId(clientId);
  if (!record) {
    // No Stripe Customer yet — there is nothing to manage; set up billing first.
    return NextResponse.json({ error: 'no-stripe-customer' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const session = await createPortalSession(
    record.stripe_customer_id,
    `${origin}/settings/billing?stripe=portal-return`,
    clientId,
  );
  if (!session.ok || !session.data.url) {
    const detail = session.ok ? 'Portal session returned no URL' : session.error.message;
    console.error('[stripe/portal] createPortalSession failed', detail);
    return NextResponse.json({ error: 'stripe-portal-failed', detail }, { status: 502 });
  }

  return NextResponse.json({ portalUrl: session.data.url });
}
