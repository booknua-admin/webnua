-- =============================================================================
-- Webnua backend — Phase 7 Session 1 · client_stripe_customers.
--
-- Webnua owns the Stripe account (standard scope, no Connect — operator
-- decision). Each Webnua client maps to ONE Stripe Customer record inside that
-- account. This table is the mapping: client_id <-> stripe_customer_id.
--
-- `status` mirrors the subscription/billing posture so app surfaces can read
-- it without a Stripe round-trip; it is kept in sync by the Stripe webhook
-- handler (a later session).
--
-- RLS: operators see all (scoped through accessible_client_ids() so juniors
-- stay inside their assignment); client-role users get no access — billing
-- posture is operator-managed. Writes are service-role only (the Stripe
-- webhook + sync jobs run as service_role).
-- =============================================================================

create table public.client_stripe_customers (
  id                 uuid primary key default gen_random_uuid(),
  -- One Stripe customer per client.
  client_id          uuid not null unique references public.clients (id) on delete cascade,
  -- The Stripe Customer id (cus_...). Unique — one client per Stripe customer.
  stripe_customer_id varchar not null unique,
  status             text not null default 'active'
                       check (status in ('active', 'past_due', 'cancelled', 'paused')),
  created_at         timestamptz not null default now()
);

-- --- RLS ---------------------------------------------------------------------
alter table public.client_stripe_customers enable row level security;
revoke insert, update, delete on public.client_stripe_customers from authenticated;

create policy client_stripe_customers_select on public.client_stripe_customers
  for select to authenticated
  using (
    private.is_operator()
    and client_id in (select private.accessible_client_ids())
  );
