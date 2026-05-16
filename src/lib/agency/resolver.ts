// =============================================================================
// Policy resolver — the spine of the layered policy model.
//
// resolvePolicy(key, clientId) walks the layers, top wins:
//   3   — sub-account override   (override-stub)        → source 'override'
//   2.5 — assigned plan's bundle (lib/billing/)         → source 'plan'
//   2   — agency default         (agency-policy-stub)   → source 'agency'
//
//   effective = override ?? assignedPlan.policy[key] ?? agencyPolicy[key]
//
// Plans exist only for sub-accounts; agency mode (clientId === null) has no
// plan layer. Pure functions over the stub stores — when the backend lands the
// stores change, this file does not.
//
// Note (Cluster 9 · Session 1): this is the first agency ↔ billing link —
// resolver imports the plan-assignment store (value) from `lib/billing/`,
// which imports PolicyValueMap (type-only) back. No runtime cycle.
// =============================================================================

import { getAssignedPlanId } from '@/lib/billing/plan-assignment-stub';
import { getPlan } from '@/lib/billing/plan-catalog-stub';
import { getAgencyPolicy } from './agency-policy-stub';
import { getOverride, hasOverride } from './override-stub';
import {
  POLICY_KEYS,
  type AllPolicyResolutions,
  type PolicyKey,
  type PolicyResolution,
} from './types';

/** Resolve one policy key for a workspace context. `clientId` is null in
 *  agency mode, or the active sub-account's id in sub-account mode. */
export function resolvePolicy<K extends PolicyKey>(
  key: K,
  clientId: string | null,
): PolicyResolution<K> {
  const agencyValue = getAgencyPolicy(key);

  // Layer 2.5 — the assigned plan's policy bundle. Only sub-accounts have a
  // plan; a key absent from the bundle (undefined) means the plan does not
  // speak to it, so it falls through to the agency default.
  let planValue: PolicyResolution<K>['planValue'];
  if (clientId !== null) {
    const planId = getAssignedPlanId(clientId);
    if (planId !== null) {
      const supplied = getPlan(planId)?.policy[key];
      if (supplied !== undefined) {
        planValue = supplied as PolicyResolution<K>['planValue'];
      }
    }
  }

  // Layer 3 — a per-sub-account override beats the plan and the agency value.
  if (clientId !== null && hasOverride(clientId, key)) {
    return {
      effectiveValue: getOverride(
        clientId,
        key,
      ) as PolicyResolution<K>['effectiveValue'],
      source: 'override',
      agencyValue,
      planValue,
    };
  }

  // Layer 2.5 — the plan, when it supplies this key.
  if (planValue !== undefined) {
    return { effectiveValue: planValue, source: 'plan', agencyValue, planValue };
  }

  // Layer 2 — the agency default.
  return { effectiveValue: agencyValue, source: 'agency', agencyValue, planValue };
}

/** Resolve every policy key for a workspace context in one pass. */
export function resolveAllPolicies(
  clientId: string | null,
): AllPolicyResolutions {
  const out: Record<PolicyKey, PolicyResolution<PolicyKey>> = {} as Record<
    PolicyKey,
    PolicyResolution<PolicyKey>
  >;
  for (const key of POLICY_KEYS) {
    out[key] = resolvePolicy(key, clientId);
  }
  return out as AllPolicyResolutions;
}
