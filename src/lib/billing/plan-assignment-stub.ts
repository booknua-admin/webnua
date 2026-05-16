// =============================================================================
// STUB — plan assignment store (Cluster 9 · Session 1).
//
// Which plan each client (sub-account) is on: a flat Record<clientId, planId>.
// A client absent from the map has no plan — its policy resolves straight from
// the agency default (the resolver's plan layer is skipped).
//
// The seed assigns the three live clients; NeatWorks is left unassigned so the
// no-plan resolution path is exercised. Like override-stub, the first
// localStorage write bakes the seed in, after which the overlay is
// authoritative (clears can then truly clear).
//
// When real auth ships, replaced by reads/writes against a `plan_assignments`
// table; the accessor surface keeps its shape.
//
// Snapshot discipline (CLAUDE.md): the parsed store is cached keyed on the raw
// localStorage string so reads through useSyncExternalStore stay stable.
// =============================================================================

import { getPlan } from './plan-catalog-stub';
import type { Plan } from './types';

const STORE_KEY = 'webnua.dev.plan-assignments';
const CHANGE_EVENT = 'webnua:plan-assignments-change';

/** clientId → planId. A missing key means the client has no plan. */
type AssignmentStore = Record<string, string>;

/** Plan assignments that exist at platform start. */
export const PLAN_ASSIGNMENT_SEED: AssignmentStore = {
  voltline: 'basic',
  freshhome: 'pro',
  keyhero: 'pro',
  // neatworks intentionally unassigned — exercises the no-plan path.
};

function safeRead(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

let cacheRaw: string | null | undefined;
let cacheValue: AssignmentStore = PLAN_ASSIGNMENT_SEED;

function readStore(): AssignmentStore {
  const raw = safeRead();
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  if (!raw) {
    cacheValue = PLAN_ASSIGNMENT_SEED;
    return cacheValue;
  }
  try {
    const parsed = JSON.parse(raw) as AssignmentStore;
    cacheValue =
      parsed && typeof parsed === 'object' ? parsed : PLAN_ASSIGNMENT_SEED;
  } catch {
    cacheValue = PLAN_ASSIGNMENT_SEED;
  }
  return cacheValue;
}

function writeStore(store: AssignmentStore): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

// --- Reads -------------------------------------------------------------------

/** The plan id assigned to a client, or null when the client has no plan. */
export function getAssignedPlanId(clientId: string): string | null {
  return readStore()[clientId] ?? null;
}

/** The resolved Plan a client is on, or null when unassigned or the assigned
 *  plan id is no longer in the catalog. */
export function getAssignedPlan(clientId: string): Plan | null {
  const planId = readStore()[clientId];
  return planId ? (getPlan(planId) ?? null) : null;
}

/** Every assignment at once. Reference-stable per overlay state. */
export function getAllPlanAssignments(): AssignmentStore {
  return readStore();
}

// --- Writes ------------------------------------------------------------------

/** Assign a client to a plan. */
export function setPlanAssignment(clientId: string, planId: string): void {
  writeStore({ ...readStore(), [clientId]: planId });
}

/** Remove a client's plan assignment — its policy reverts to agency defaults. */
export function clearPlanAssignment(clientId: string): void {
  const store = readStore();
  if (!(clientId in store)) return;
  const next = { ...store };
  delete next[clientId];
  writeStore(next);
}

export function subscribePlanAssignments(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
