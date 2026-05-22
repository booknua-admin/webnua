// =============================================================================
// Stripe billing — shared types.
//
// Two kinds of type live here:
//   • The slices of Stripe API objects this integration actually reads. Stripe
//     objects are large; we type only the fields consumed (defensively — most
//     are optional, so a Stripe API-version shift cannot crash a handler).
//   • The client_stripe_customers row shape (extended by migration 0057). That
//     table is not in the generated Database type yet, so it is hand-written
//     here — same rationale as _shared/db-types.ts.
//
// Phase 7 Stripe billing session.
// =============================================================================

// --- Stripe API object slices ------------------------------------------------

/** A Stripe Customer (cus_…). */
export type StripeCustomer = {
  id: string;
  email: string | null;
  name: string | null;
};

/** A Stripe Checkout Session (cs_…). `url` is the hosted-checkout link. */
export type StripeCheckoutSession = {
  id: string;
  url: string | null;
};

/** A Stripe Billing Portal Session — `url` is the hosted-portal link. */
export type StripePortalSession = {
  id: string;
  url: string;
};

/** One item line of a Stripe Subscription. */
export type StripeSubscriptionItem = {
  /** Stripe API 2025-03-31+ carries the period end here, per item. */
  current_period_end?: number;
  price?: { id?: string };
};

/** A Stripe Subscription (sub_…). */
export type StripeSubscription = {
  id: string;
  /** The Stripe Customer id this subscription belongs to (cus_…). */
  customer: string;
  /** Stripe's own status enum — mapped to our StripeBillingStatus. */
  status: string;
  /** Period end (unix seconds). Pre-2025-03-31 API versions carry it here;
   *  newer versions moved it onto the subscription items. extractPeriodEnd()
   *  reads both. */
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: { data?: StripeSubscriptionItem[] };
};

/** A Stripe Invoice (in_…). */
export type StripeInvoice = {
  id: string;
  customer: string;
  subscription?: string | null;
  status?: string;
  status_transitions?: { paid_at?: number | null };
  /** Invoice creation time (unix seconds). */
  created?: number;
};

/** A Stripe webhook Event envelope (evt_…). */
export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

// --- our billing posture -----------------------------------------------------

/**
 * The billing posture stored on client_stripe_customers.status.
 *   • incomplete — a Stripe Customer record exists but no subscription yet.
 *   • active / past_due / cancelled / paused — mirror the Stripe subscription.
 */
export type StripeBillingStatus = 'incomplete' | 'active' | 'past_due' | 'cancelled' | 'paused';

export type StripePaymentStatus = 'succeeded' | 'failed';

/** A client_stripe_customers row (migration 0052 + 0057). Hand-written until
 *  the generated Database type is regenerated post-deploy. */
export type ClientStripeCustomerRow = {
  id: string;
  client_id: string;
  stripe_customer_id: string;
  status: StripeBillingStatus;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_payment_at: string | null;
  last_payment_status: StripePaymentStatus | null;
  past_due_since: string | null;
  created_at: string;
  updated_at: string;
};

// --- live plan info (Stripe is the source of truth) --------------------------

/**
 * The plan's display details, resolved LIVE from the Stripe Price object — the
 * UI reads this, never a hardcoded constant, so the displayed price always
 * matches what Stripe charges at checkout. Produced by getPlanInfo() and served
 * to the browser by GET /api/integrations/stripe/plan-info.
 */
export type PlanInfo = {
  priceId: string;
  /** The Price nickname, falling back to the product name. */
  displayName: string;
  /** The recurring amount in the currency's minor unit (e.g. cents). */
  amount: number;
  /** ISO currency code, lower-case as Stripe returns it (e.g. 'eur'). */
  currency: string;
  /** Billing interval — 'month' / 'year' / 'week' / 'day'. */
  interval: string;
  /** Intervals per billing cycle (usually 1). */
  intervalCount: number;
  productName: string;
  productDescription: string | null;
  /** Optional "what's included" list, sourced from the Stripe Price's
   *  `features` metadata key (a JSON array of strings). Empty when unset. */
  features: string[];
};
