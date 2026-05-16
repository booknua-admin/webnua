'use client';

// =============================================================================
// React hooks over the billing stub stores (Cluster 9 · Session 1).
//
//   usePlanCatalog()        → the full plan catalog, reactive to catalog edits.
//   usePlan(planId)         → one plan by id.
//   useAssignedPlanId(id)   → the plan id a client is on, or null.
//   useAssignedPlan(id)     → the resolved Plan a client is on, or null.
//
// Snapshot discipline (CLAUDE.md): every accessor below is reference-stable —
// the underlying stores cache their parsed snapshots keyed on the raw
// localStorage string, so useSyncExternalStore won't spin.
// =============================================================================

import { useSyncExternalStore } from 'react';

import {
  getAssignedPlan,
  getAssignedPlanId,
  subscribePlanAssignments,
} from './plan-assignment-stub';
import {
  PLAN_CATALOG_SEED,
  getPlan,
  getPlanCatalog,
  subscribePlanCatalog,
} from './plan-catalog-stub';
import type { Plan } from './types';

/** Subscribe to everything that can move an assigned plan's resolved value —
 *  the catalog (a plan's bundle changed) and the assignment map. */
function subscribeBilling(callback: () => void): () => void {
  const offCatalog = subscribePlanCatalog(callback);
  const offAssignments = subscribePlanAssignments(callback);
  return () => {
    offCatalog();
    offAssignments();
  };
}

/** The full plan catalog, reactive to catalog edits. */
export function usePlanCatalog(): readonly Plan[] {
  return useSyncExternalStore(
    subscribePlanCatalog,
    getPlanCatalog,
    () => PLAN_CATALOG_SEED,
  );
}

/** One plan by id, reactive to catalog edits. */
export function usePlan(planId: string | null): Plan | undefined {
  return useSyncExternalStore(
    subscribePlanCatalog,
    () => (planId ? getPlan(planId) : undefined),
    () => (planId ? PLAN_CATALOG_SEED.find((p) => p.id === planId) : undefined),
  );
}

/** The plan id a client is assigned to, or null. */
export function useAssignedPlanId(clientId: string | null): string | null {
  return useSyncExternalStore(
    subscribePlanAssignments,
    () => (clientId ? getAssignedPlanId(clientId) : null),
    () => null,
  );
}

/** The resolved Plan a client is on, or null when unassigned. */
export function useAssignedPlan(clientId: string | null): Plan | null {
  return useSyncExternalStore(
    subscribeBilling,
    () => (clientId ? getAssignedPlan(clientId) : null),
    () => null,
  );
}
