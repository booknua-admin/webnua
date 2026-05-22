// =============================================================================
// Stripe billing — client_stripe_customers data access + webhook appliers.
//
// Phase 7 Stripe billing session. This module owns every read/write of
// client_stripe_customers: the checkout route looks up / inserts a row here,
// and the webhook handler applies subscription / invoice events through the
// apply* functions. Stripe → our-schema mapping (status, period end) also
// lives here — it is the one place that translates Stripe shapes into the
// columns migration 0057 added.
//
// client_stripe_customers is not in the generated Database type yet, so this
// reaches it through getIntegrationDb() (the untyped service-role client).
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  ClientStripeCustomerRow,
  StripeBillingStatus,
  StripeInvoice,
  StripeSubscription,
} from './types';

const TABLE = 'client_stripe_customers';

const ROW_COLUMNS =
  'id, client_id, stripe_customer_id, status, stripe_subscription_id, ' +
  'stripe_price_id, current_period_end, cancel_at_period_end, last_payment_at, ' +
  'last_payment_status, past_due_since, created_at, updated_at';

// --- mapping helpers ---------------------------------------------------------

function unixToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Map Stripe's subscription-status enum onto our four-value billing posture.
 *  Total — an unknown / future Stripe status reads as past_due (needs
 *  attention) rather than being silently treated as active or cancelled. */
export function mapStripeStatus(stripeStatus: string): StripeBillingStatus {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'incomplete':
      return 'incomplete';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    case 'paused':
      return 'paused';
    default:
      return 'past_due';
  }
}

/** The current-period-end of a subscription as an ISO string. Reads both the
 *  legacy top-level field and the per-item field (Stripe API 2025-03-31+ moved
 *  it onto the items). */
export function extractPeriodEnd(sub: StripeSubscription): string | null {
  return unixToIso(sub.current_period_end) ?? unixToIso(sub.items?.data?.[0]?.current_period_end);
}

// --- reads -------------------------------------------------------------------

export async function getStripeCustomerByClientId(
  clientId: string,
): Promise<ClientStripeCustomerRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(ROW_COLUMNS)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) {
    throw new Error(`getStripeCustomerByClientId: ${error.message}`);
  }
  return (data as ClientStripeCustomerRow | null) ?? null;
}

export async function getStripeCustomerByStripeId(
  stripeCustomerId: string,
): Promise<ClientStripeCustomerRow | null> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .select(ROW_COLUMNS)
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle();
  if (error) {
    throw new Error(`getStripeCustomerByStripeId: ${error.message}`);
  }
  return (data as ClientStripeCustomerRow | null) ?? null;
}

/** Insert the mapping row for a freshly-created Stripe Customer. The row is
 *  'incomplete' until the customer.subscription.created webhook lands. */
export async function insertStripeCustomer(
  clientId: string,
  stripeCustomerId: string,
): Promise<ClientStripeCustomerRow> {
  const { data, error } = await getIntegrationDb()
    .from(TABLE)
    .insert({
      client_id: clientId,
      stripe_customer_id: stripeCustomerId,
      status: 'incomplete',
    })
    .select(ROW_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`insertStripeCustomer: ${error?.message ?? 'no row returned'}`);
  }
  return data as unknown as ClientStripeCustomerRow;
}

// --- webhook appliers --------------------------------------------------------

/** The outcome of applying a webhook event. `no_customer` = the event refers
 *  to a Stripe customer we do not have a row for (logged, not an error). */
export type ApplyOutcome = {
  outcome: 'applied' | 'no_customer';
  clientId: string | null;
};

/** Apply a customer.subscription.{created,updated,deleted} event. */
export async function applySubscriptionEvent(
  sub: StripeSubscription,
  options: { deleted: boolean },
): Promise<ApplyOutcome> {
  const row = await getStripeCustomerByStripeId(sub.customer);
  if (!row) return { outcome: 'no_customer', clientId: null };

  const status: StripeBillingStatus = options.deleted ? 'cancelled' : mapStripeStatus(sub.status);

  const patch: Record<string, unknown> = {
    status,
    stripe_subscription_id: sub.id,
    stripe_price_id: sub.items?.data?.[0]?.price?.id ?? row.stripe_price_id,
    current_period_end: extractPeriodEnd(sub) ?? row.current_period_end,
    cancel_at_period_end: options.deleted ? false : Boolean(sub.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };
  // Maintain the past_due grace marker. Set it the first time we see past_due
  // (keep the original timestamp on subsequent events); clear it otherwise.
  if (status === 'past_due') {
    if (!row.past_due_since) patch.past_due_since = new Date().toISOString();
  } else {
    patch.past_due_since = null;
  }

  const { error } = await getIntegrationDb().from(TABLE).update(patch).eq('id', row.id);
  if (error) throw new Error(`applySubscriptionEvent: ${error.message}`);
  return { outcome: 'applied', clientId: row.client_id };
}

/** Apply an invoice.payment_succeeded event — record the payment and clear any
 *  past_due posture (a successful charge means the subscription recovered). */
export async function applyInvoicePaid(invoice: StripeInvoice): Promise<ApplyOutcome> {
  const row = await getStripeCustomerByStripeId(invoice.customer);
  if (!row) return { outcome: 'no_customer', clientId: null };

  const paidAt =
    unixToIso(invoice.status_transitions?.paid_at) ??
    unixToIso(invoice.created) ??
    new Date().toISOString();

  const { error } = await getIntegrationDb()
    .from(TABLE)
    .update({
      last_payment_at: paidAt,
      last_payment_status: 'succeeded',
      // A successful payment recovers a past_due subscription; a cancelled one
      // stays cancelled (a cancelled subscription should not produce a charge,
      // but never resurrect it if it somehow does).
      status: row.status === 'cancelled' ? 'cancelled' : 'active',
      past_due_since: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (error) throw new Error(`applyInvoicePaid: ${error.message}`);
  return { outcome: 'applied', clientId: row.client_id };
}

/** Apply an invoice.payment_failed event — move the subscription to past_due
 *  and stamp the first-failure timestamp the grace window is measured from. */
export async function applyInvoiceFailed(invoice: StripeInvoice): Promise<ApplyOutcome> {
  const row = await getStripeCustomerByStripeId(invoice.customer);
  if (!row) return { outcome: 'no_customer', clientId: null };

  const { error } = await getIntegrationDb()
    .from(TABLE)
    .update({
      status: 'past_due',
      past_due_since: row.past_due_since ?? new Date().toISOString(),
      last_payment_status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);
  if (error) throw new Error(`applyInvoiceFailed: ${error.message}`);
  return { outcome: 'applied', clientId: row.client_id };
}
