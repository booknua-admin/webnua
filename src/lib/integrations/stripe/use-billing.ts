'use client';

// =============================================================================
// Stripe billing — operator UI data layer.
//
// Phase 7 Stripe billing session. Reads + actions behind the "Subscription &
// payment" section on the sub-account /settings/billing surface.
//
//   • useStripeBilling — a client's client_stripe_customers posture. Read
//     straight from the browser Supabase client; the table's RLS scopes it to
//     operators + their accessible clients, so no API route is needed.
//   • startStripeCheckout / openStripePortal — POST the operator-only routes,
//     then navigate the browser to the Stripe-hosted page.
//
// client_stripe_customers is not in the generated Database type, so the
// browser client is cast to untyped for this read — same pattern as
// lib/integrations/use-connections.ts.
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import type {
  PlanInfo,
  StripeBillingStatus,
  StripePaymentStatus,
} from '@/lib/integrations/stripe/types';
import { supabase } from '@/lib/supabase/client';

/** A client's billing posture as the operator UI consumes it. `null` from the
 *  query means no client_stripe_customers row — billing was never set up. */
export type StripeBillingView = {
  status: StripeBillingStatus;
  hasSubscription: boolean;
  subscriptionId: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  lastPaymentAt: string | null;
  lastPaymentStatus: StripePaymentStatus | null;
  pastDueSince: string | null;
};

type BillingRowSelect = {
  status: StripeBillingStatus;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_payment_at: string | null;
  last_payment_status: StripePaymentStatus | null;
  past_due_since: string | null;
};

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function billingKey(clientId: string | null) {
  return ['stripe-billing', clientId] as const;
}

async function fetchBilling(clientId: string): Promise<StripeBillingView | null> {
  const { data, error } = await db()
    .from('client_stripe_customers')
    .select(
      'status, stripe_subscription_id, stripe_price_id, current_period_end, ' +
        'cancel_at_period_end, last_payment_at, last_payment_status, past_due_since',
    )
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw normalizeError(error);
  if (!data) return null;
  const row = data as unknown as BillingRowSelect;
  return {
    status: row.status,
    hasSubscription: row.stripe_subscription_id != null,
    subscriptionId: row.stripe_subscription_id,
    priceId: row.stripe_price_id,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    lastPaymentAt: row.last_payment_at,
    lastPaymentStatus: row.last_payment_status,
    pastDueSince: row.past_due_since,
  };
}

/** A client's Stripe billing posture. Disabled (idle) until a client UUID is
 *  set. */
export function useStripeBilling(clientId: string | null) {
  return useQuery({
    queryKey: billingKey(clientId),
    queryFn: () => fetchBilling(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

// --- live plan info ----------------------------------------------------------

async function fetchPlanInfo(): Promise<PlanInfo> {
  const response = await fetch('/api/integrations/stripe/plan-info');
  if (!response.ok) {
    throw new Error('Plan pricing is unavailable right now.');
  }
  return (await response.json()) as PlanInfo;
}

/** The live plan details from Stripe (name / price / currency / interval).
 *  The UI reads this instead of hardcoding the price; `staleTime` matches the
 *  server-side 5-minute cache window. */
export function usePlanInfo() {
  return useQuery({
    queryKey: ['stripe-plan-info'],
    queryFn: fetchPlanInfo,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/** Format a PlanInfo as a price label — e.g. "€299.00/month". */
export function formatPlanPrice(info: PlanInfo): string {
  const major = (info.amount ?? 0) / 100;
  let money: string;
  try {
    money = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: info.currency.toUpperCase(),
    }).format(major);
  } catch {
    // Unknown currency code — fall back to a plain amount + code.
    money = `${major.toFixed(2)} ${info.currency.toUpperCase()}`;
  }
  const period = info.intervalCount > 1 ? `${info.intervalCount} ${info.interval}s` : info.interval;
  return `${money}/${period}`;
}

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out — sign in again to manage billing.');
  return token;
}

/** Map a route error code to an operator-facing message. */
function billingErrorMessage(code: string | undefined, fallbackStatus: number): string {
  switch (code) {
    case 'stripe-not-configured':
      return 'Stripe billing is not configured yet — add the Stripe keys to the deployment.';
    case 'no-billing-email':
      return 'This client has no billing email. Add a primary contact email or invite a team member first.';
    case 'client-not-found':
      return 'That client could not be found.';
    case 'already-subscribed':
      return 'This client already has a subscription — use Manage billing instead.';
    case 'no-stripe-customer':
      return 'Billing has not been set up for this client yet.';
    case 'forbidden':
    case 'forbidden-client':
      return 'You do not have access to this client.';
    case 'unauthenticated':
      return 'You are signed out — sign in again to manage billing.';
    default:
      return `Could not reach Stripe (${code ?? fallbackStatus}).`;
  }
}

/**
 * Start the Checkout flow for a client. POSTs the checkout route, then
 * navigates the browser to Stripe's hosted checkout. Resolves only on failure
 * (on success the page has already navigated away).
 */
export async function startStripeCheckout(clientId: string): Promise<void> {
  const token = await accessToken();
  const response = await fetch('/api/integrations/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(billingErrorMessage(body.error, response.status));
  }
  const { checkoutUrl } = (await response.json()) as { checkoutUrl: string };
  window.location.assign(checkoutUrl);
}

/**
 * Open the Stripe Customer Portal for a client. POSTs the portal route, then
 * navigates the browser to Stripe's hosted portal.
 */
export async function openStripePortal(clientId: string): Promise<void> {
  const token = await accessToken();
  const response = await fetch('/api/integrations/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(billingErrorMessage(body.error, response.status));
  }
  const { portalUrl } = (await response.json()) as { portalUrl: string };
  window.location.assign(portalUrl);
}
