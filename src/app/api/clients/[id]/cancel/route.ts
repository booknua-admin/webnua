// =============================================================================
// POST /api/clients/[id]/cancel
//
// Pattern B two-stage cancellation, customer-initiated entry. The
// real cancellation source-of-truth is the Stripe Customer Portal — when
// the customer cancels there, Stripe fires `customer.subscription.deleted`
// and the webhook applies the state via `applyStripeCancellation`. This
// route is the alternative path: the customer can also cancel from the
// /settings/billing surface directly without leaving the app.
//
// The route mints a Stripe Customer Portal session targeted at the
// "cancel subscription" deep link and returns the portal URL — the client
// follows it, cancels on Stripe's hosted UI, and the webhook handles the
// lifecycle flip. We deliberately do NOT touch lifecycle_status here:
//   - It would diverge from the Stripe SoT (the customer's subscription
//     might still be active on Stripe's side until they confirm there).
//   - The webhook is already wired + idempotent.
//
// Auth: requireClientAccess — a client cancels their own; an operator can
// cancel on the customer's behalf (concierge cancellation).
// =============================================================================

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { createPortalSession, isStripeConfigured } from '@/lib/integrations/stripe/client';
import { getStripeCustomerByClientId } from '@/lib/integrations/stripe/customers';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';

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

  const stripeCustomer = await getStripeCustomerByClientId(clientId);
  if (!stripeCustomer) {
    return NextResponse.json({ error: 'no-subscription' }, { status: 404 });
  }

  // Return-to URL: the dashboard. After Stripe processes the cancel +
  // fires the webhook, the customer lands back on /dashboard and sees the
  // cancellation banner (the read-only state — see CancellationBanner).
  const origin = new URL(request.url).origin;
  const returnUrl = `${origin}/dashboard`;

  const portal = await createPortalSession(
    stripeCustomer.stripe_customer_id,
    returnUrl,
    clientId,
  );
  if (!portal.ok) {
    console.error('[cancel] portal session failed', portal.error);
    return NextResponse.json({ error: 'portal-failed' }, { status: 502 });
  }

  // Voice env so eslint doesn't strip the import if a future edit removes
  // every other reference — defensive.
  void env.APP_HOST;

  return NextResponse.json({ ok: true, url: portal.data.url });
}
