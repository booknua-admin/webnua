// =============================================================================
// Billing — plan layer types (Cluster 9 · Session 1).
//
// A Plan sits between the agency default and a per-sub-account override in the
// policy resolution stack — it carries a partial policy BUNDLE the agency
// offers as a packaged tier (seat limit, capability floor, integration
// defaults, …). See the resolver: effective = override ?? plan ?? agency.
//
// `lib/billing/` imports PolicyValueMap from `lib/agency/` (type-only); the
// resolver imports plan-assignment back the other way (value). No runtime
// cycle — the first agency ↔ billing link.
// =============================================================================

import type { PolicyValueMap } from '@/lib/agency/types';

export type BillingCycle = 'monthly' | 'yearly';

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/** A billing plan in the agency catalog. `policy` is the partial bundle of
 *  policy keys this plan supplies — a key present here is set by the plan, a
 *  key absent falls through to the agency default. Sub-account overrides
 *  still win over the plan. */
export type Plan = {
  id: string;
  name: string;
  description: string;
  /** Price per billing cycle, in whole units of `currency` (e.g. dollars). */
  price: number;
  /** ISO 4217 code, e.g. 'AUD'. */
  currency: string;
  billingCycle: BillingCycle;
  /** The policy keys this plan supplies — Layer 2.5 of the resolution stack. */
  policy: Partial<PolicyValueMap>;
};

/** One client's plan assignment. The store keys clientId → planId; this is the
 *  resolved pair a consumer reads back. */
export type PlanAssignment = {
  clientId: string;
  planId: string;
};
