'use client';

// =============================================================================
// React hooks over the policy resolver.
//
//   usePolicy(key)        → PolicyResolution<K>, resolved against the ACTIVE
//                           workspace (agency mode or the drilled-in
//                           sub-account). Reactive to both policy stores.
//   useAgencyPolicy(key)  → the raw Layer-2 agency value, ignoring overrides.
//
// Snapshot discipline (CLAUDE.md): resolvePolicy builds a fresh object each
// call, which would spin useSyncExternalStore into an infinite loop. The
// resolution snapshot is cached per (key, clientId) against a JSON key so the
// reference only changes when the resolved value actually changes.
// =============================================================================

import { useSyncExternalStore } from 'react';

import { subscribePlanAssignments } from '@/lib/billing/plan-assignment-stub';
import { subscribePlanCatalog } from '@/lib/billing/plan-catalog-stub';
import { useWorkspace } from '@/lib/workspace/workspace-stub';
import {
  AGENCY_POLICY_SEED,
  getAgencyPolicy,
  subscribeAgencyPolicy,
} from './agency-policy-stub';
import { subscribeOverrides } from './override-stub';
import { resolvePolicy } from './resolver';
import type { PolicyKey, PolicyResolution, PolicyValueMap } from './types';

/** Subscribe to every store the resolver reads from — the agency policy, the
 *  per-sub-account overrides, and (Cluster 9 · Session 1) the plan layer. */
function subscribeResolver(callback: () => void): () => void {
  const offPolicy = subscribeAgencyPolicy(callback);
  const offOverrides = subscribeOverrides(callback);
  const offCatalog = subscribePlanCatalog(callback);
  const offAssignments = subscribePlanAssignments(callback);
  return () => {
    offPolicy();
    offOverrides();
    offCatalog();
    offAssignments();
  };
}

const snapshotCache = new Map<
  string,
  { raw: string; value: PolicyResolution<PolicyKey> }
>();

/** Reference-stable resolution snapshot for (key, clientId). */
function resolutionSnapshot<K extends PolicyKey>(
  key: K,
  clientId: string | null,
): PolicyResolution<K> {
  const cacheKey = `${key}|${clientId ?? '__agency__'}`;
  const resolved = resolvePolicy(key, clientId);
  const raw = JSON.stringify(resolved);
  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.raw === raw) {
    return cached.value as PolicyResolution<K>;
  }
  snapshotCache.set(cacheKey, {
    raw,
    value: resolved as PolicyResolution<PolicyKey>,
  });
  return resolved;
}

/** Resolve a policy key against the active workspace context. */
export function usePolicy<K extends PolicyKey>(key: K): PolicyResolution<K> {
  const { activeClientId } = useWorkspace();
  return useSyncExternalStore(
    subscribeResolver,
    () => resolutionSnapshot(key, activeClientId),
    () => resolutionSnapshot(key, null),
  );
}

/** The raw Layer-2 agency value for a key — overrides ignored. */
export function useAgencyPolicy<K extends PolicyKey>(
  key: K,
): PolicyValueMap[K] {
  return useSyncExternalStore(
    subscribeAgencyPolicy,
    () => getAgencyPolicy(key),
    () => AGENCY_POLICY_SEED[key],
  );
}
