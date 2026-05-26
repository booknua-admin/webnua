// =============================================================================
// GET /api/clients/[id]/billing-gate
//
// Returns whether the client's access should be currently suspended due to
// billing posture — wraps `shouldGateClientAccess()`
// (`lib/integrations/stripe/billing-status.ts`). The dashboard consumes this
// to render `<BillingSuspendedScreen>` in place of the normal workspace when
// `gated === true`.
//
// Gate triggers:
//   - subscription `cancelled` (Stripe `customer.subscription.deleted`), OR
//   - subscription `past_due` for longer than the 7-day grace window (the
//     first failed payment + 7 days, tracked via past_due_since on
//     client_stripe_customers).
//
// A client with NO billing setup (no client_stripe_customers row) is NOT
// gated — "never set up" is not "stopped paying". The dashboard's existing
// onboarding flow handles the pre-billing state.
//
// Auth: requireClientAccess — a client checks their own; an operator can
// check on their behalf (concierge model). Returns `{ gated: false }` for
// any client whose billing isn't gated, including the "no Stripe customer
// row" case — same shape, no missing-data branch for the client to handle.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';
import { shouldGateClientAccess } from '@/lib/integrations/stripe/billing-status';
import { getStripeCustomerByClientId } from '@/lib/integrations/stripe/customers';

export type BillingGateResponse = {
  gated: boolean;
  /** Present only when gated — names which lifecycle branch fired. */
  reason?: 'cancelled' | 'past_due_grace_elapsed';
};

export async function GET(
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

  const gated = await shouldGateClientAccess(clientId);
  if (!gated) {
    return NextResponse.json({ gated: false } satisfies BillingGateResponse, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  }

  // Resolve the gate reason — cheap follow-up read (one row).
  const row = await getStripeCustomerByClientId(clientId);
  const reason: BillingGateResponse['reason'] =
    row?.status === 'cancelled' ? 'cancelled' : 'past_due_grace_elapsed';

  return NextResponse.json({ gated: true, reason } satisfies BillingGateResponse, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
