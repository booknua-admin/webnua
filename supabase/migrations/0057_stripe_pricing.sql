-- =============================================================================
-- Webnua backend — Phase 7 Stripe billing · 0057_stripe_pricing.sql.
--
-- The Stripe billing session. Migration 0052 mapped a Webnua client to a Stripe
-- Customer (client_id <-> stripe_customer_id); this migration extends
-- client_stripe_customers with the SUBSCRIPTION posture so app surfaces can
-- read billing state without a Stripe round-trip. The columns are kept in sync
-- by the Stripe webhook handler (/api/integrations/stripe/webhook).
--
-- Pricing model — V1 is a SINGLE plan: €299/month. The Stripe Price id is held
-- in the STRIPE_PRICE_ID_STANDARD env var, NOT in a database table. The columns
-- below record which price a given subscription is actually on
-- (stripe_price_id) for reconciliation, but the catalogue of sellable prices is
-- env configuration.
--
-- Adding tiers later: each new tier is a new Price created in the Stripe
-- dashboard plus a new env var (STRIPE_PRICE_ID_PRO, …). Once there is more
-- than a handful, promote the catalogue to a real `stripe_prices` table
-- (price id, nickname, unit amount, currency, interval, active) and have the
-- checkout route resolve the price from it. Not warranted for one price.
--
-- The marketing framing — "€99 platform fee + €200 Meta ad credit" in month 1
-- — is UI presentation only. Stripe charges a flat €299 every month; the ad
-- credit is handled OUTSIDE Stripe by the Meta ads integration. There is no
-- month-1 discount Price and no column for one.
--
-- RLS / grants: unchanged. client_stripe_customers stays operator-SELECT
-- (scoped through accessible_client_ids()) and service-role-write. The new
-- columns inherit the table's existing policy — SELECT is column-agnostic.
-- =============================================================================

alter table public.client_stripe_customers
  -- The active Stripe Subscription (sub_…). NULL until checkout completes and
  -- the customer.subscription.created webhook lands. Not unique — a client can
  -- churn and re-subscribe, leaving a series of subscription ids over time.
  add column stripe_subscription_id varchar,
  -- The Stripe Price the subscription is on (price_…). Lets a later multi-tier
  -- world reconcile a client against the catalogue. NULL until subscribed.
  add column stripe_price_id text,
  -- End of the current paid period — i.e. the next renewal date. Driven from
  -- the subscription object on every subscription webhook.
  add column current_period_end timestamptz,
  -- True once the subscription is set to cancel at period end (the customer
  -- cancelled via the Stripe portal but access runs to the period boundary).
  add column cancel_at_period_end boolean not null default false,
  -- The most recent invoice payment outcome.
  add column last_payment_at timestamptz,
  add column last_payment_status text
    check (last_payment_status is null
           or last_payment_status in ('succeeded', 'failed')),
  -- When the subscription first entered past_due (the first failed payment).
  -- shouldGateClientAccess() uses this for the 7-day grace window; it is
  -- cleared when a payment succeeds and the subscription recovers.
  add column past_due_since timestamptz,
  -- Bumped by the webhook handler on every write — observability.
  add column updated_at timestamptz not null default now();

-- The status enum gains 'incomplete' — the posture of a client that has a
-- Stripe Customer record but no subscription yet (the checkout route creates
-- the customer row up front, before the customer completes Checkout). Without
-- it a customer-but-no-subscription row would default to 'active' and read as
-- a paying client. A fresh row is now inserted 'incomplete'; the
-- customer.subscription.created webhook flips it to 'active'.
alter table public.client_stripe_customers
  drop constraint client_stripe_customers_status_check,
  add constraint client_stripe_customers_status_check
    check (status in ('incomplete', 'active', 'past_due', 'cancelled', 'paused'));

alter table public.client_stripe_customers
  alter column status set default 'incomplete';

-- Some webhook event types are keyed by subscription id; index the lookup.
-- Partial — only rows that have a subscription.
create index client_stripe_customers_subscription_idx
  on public.client_stripe_customers (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.client_stripe_customers.stripe_price_id is
  'V1: always STRIPE_PRICE_ID_STANDARD (the €299/mo price). Multi-tier later → a stripe_prices table.';
comment on column public.client_stripe_customers.status is
  'incomplete = customer record but no subscription; active/past_due/cancelled/paused mirror the Stripe subscription.';
