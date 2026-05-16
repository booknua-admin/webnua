// =============================================================================
// Policy resolver — the spine of the three-layer model.
//
// resolvePolicy(key, clientId) walks the layers:
//   - clientId === null  → agency mode: the agency value, source 'agency'.
//   - clientId set, key overridden for that sub-account → source 'override'.
//   - clientId set, key not overridden → the agency value, source 'agency'.
//
// Pure functions over the two stub stores. When the backend lands, the stores
// behind getAgencyPolicy / getOverride change; this file does not.
// =============================================================================

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

  if (clientId !== null && hasOverride(clientId, key)) {
    return {
      effectiveValue: getOverride(clientId, key) as PolicyResolution<K>['effectiveValue'],
      source: 'override',
      agencyValue,
    };
  }

  return { effectiveValue: agencyValue, source: 'agency', agencyValue };
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
