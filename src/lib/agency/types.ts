// =============================================================================
// Agency policy layer — types.
//
// The three-layer resolution model (CLAUDE.md → "Agency / sub-account model"):
//   1. Platform defaults  — code constants.
//   2. Agency policy      — what the agency sets HQ-wide (this layer).
//   3. Sub-account        — inherits Layer 2; may override it.
//
// A "policy key" is something that flows through the resolver. PolicyKey is a
// CLOSED union — the resolver is typed to it, never Record<string, unknown>.
// Adding a key means amending this union AND the CLAUDE.md policy-key table.
// =============================================================================

import type { Capability } from '@/lib/auth/capabilities';

export type PolicyKey =
  | 'defaultClientCapabilities'
  | 'integrationDefaults'
  | 'defaultSeatLimit'
  | 'brandDefaults'
  | 'automationDefaults'
  | 'pricingDefaults';

export const POLICY_KEYS: readonly PolicyKey[] = [
  'defaultClientCapabilities',
  'integrationDefaults',
  'defaultSeatLimit',
  'brandDefaults',
  'automationDefaults',
  'pricingDefaults',
] as const;

// The three keys consumed by real UI in Cluster 8 (Sessions 3-4). The rest are
// real-typed and resolver-ready but not yet wired to a surface.
export const LIVE_POLICY_KEYS: readonly PolicyKey[] = [
  'defaultClientCapabilities',
  'integrationDefaults',
  'defaultSeatLimit',
] as const;

// --- Per-key value shapes -----------------------------------------------------

/** Which integration providers the agency supplies shared keys for. `true` =
 *  sub-accounts inherit the agency connection by default; `false` = each
 *  sub-account connects its own. */
export type IntegrationDefaults = {
  sharedProviders: Record<string, boolean>;
};

export type BrandDefaults = {
  primaryFont: string;
  monoFont: string;
  accentColor: string;
};

/** automationId → whether the automation is on by default for a new client. */
export type AutomationDefaults = Record<string, boolean>;

export type PricingDefaults = {
  currency: string;
  flatRateBufferPct: number;
};

/** The closed map from policy key to its value type. */
export type PolicyValueMap = {
  defaultClientCapabilities: Capability[];
  integrationDefaults: IntegrationDefaults;
  defaultSeatLimit: number | null;
  brandDefaults: BrandDefaults;
  automationDefaults: AutomationDefaults;
  pricingDefaults: PricingDefaults;
};

// --- Resolution ---------------------------------------------------------------

/** The resolver's output for one key. The effective value is resolved down the
 *  stack — sub-account override, else the assigned plan's bundle, else the
 *  agency default (Cluster 9 · Session 1 inserted the plan layer). `source`
 *  says which layer won; `agencyValue` and `planValue` carry the lower-layer
 *  values either way so a surface can show "inherited X / overridden to Y".
 *  `planValue` is undefined when the client has no plan, or the plan's bundle
 *  omits this key. */
export type PolicyResolution<K extends PolicyKey> = {
  effectiveValue: PolicyValueMap[K];
  source: 'agency' | 'plan' | 'override';
  agencyValue: PolicyValueMap[K];
  planValue: PolicyValueMap[K] | undefined;
};

/** Every key resolved at once, for one workspace context. */
export type AllPolicyResolutions = {
  [K in PolicyKey]: PolicyResolution<K>;
};

/** Human-facing label per key — for the agency settings home + dev surfaces. */
export const POLICY_KEY_LABEL: Record<PolicyKey, string> = {
  defaultClientCapabilities: 'Default client capabilities',
  integrationDefaults: 'Integration defaults',
  defaultSeatLimit: 'Default seat limit',
  brandDefaults: 'Brand defaults',
  automationDefaults: 'Automation defaults',
  pricingDefaults: 'Pricing defaults',
};
