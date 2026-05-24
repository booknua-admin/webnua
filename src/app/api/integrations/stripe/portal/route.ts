// =============================================================================
// POST /api/integrations/stripe/portal — open the Stripe Customer Portal.
//
// Phase 7 Stripe billing session. Auth: client-or-operator. The customer may
// manage their own billing (update card, view invoices, cancel) OR an
// operator may open the portal on their behalf. Both paths mint a Billing
// Portal session for the client's existing Stripe Customer.
//
// Reached by fetch() with the caller's Supabase access token; the body
// carries the client UUID. Returns the portal URL for the browser to navigate
// to. The Customer Portal must be activated once in the Stripe dashboard
// (Settings → Billing → Customer portal) — see CLAUDE.md.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
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

  const auth = await requireClientAccess(request, clientId);
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
