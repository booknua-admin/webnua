// =============================================================================
// plan-assignment store — in-memory cache hydrated from Supabase.
//
// Which plan each client (sub-account) is on: Record<clientSlug, planId>.
// A client absent from the map has no plan — policy resolves from agency default.
//
// Snapshot discipline (CLAUDE.md): getAllPlanAssignments() is reference-stable.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { getClientSlugByUuid, getClientUuidBySlug } from '@/lib/clients/clients-store';
import { getPlan } from './plan-catalog-stub';
import type { Plan } from './types';

const CHANGE_EVENT = 'webnua:plan-assignments-change';

/** clientSlug → planId. A missing key means the client has no plan. */
type AssignmentStore = Record<string, string>;

/** Plan assignments that exist at platform start. */
export const PLAN_ASSIGNMENT_SEED: AssignmentStore = {
  voltline: 'basic',
  freshhome: 'pro',
  keyhero: 'pro',
  // neatworks intentionally unassigned — exercises the no-plan path.
};

// --- In-memory cache ---------------------------------------------------------

let cache: AssignmentStore = { ...PLAN_ASSIGNMENT_SEED };
let version = 0;
let snapshotVersion = -1;
let snapshotValue: AssignmentStore = PLAN_ASSIGNMENT_SEED;

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// --- Hydration ---------------------------------------------------------------

export async function hydratePlanAssignments(): Promise<void> {
  const { data, error } = await supabase
    .from('plan_assignments')
    .select('client_id, plan_id');

  if (error) {
    console.error('[plan-assignments] hydrate failed:', normalizeError(error).message);
    return;
  }

  if (!data || data.length === 0) {
    return;
  }

  const next: AssignmentStore = {};
  for (const row of data) {
    const slug = getClientSlugByUuid(row.client_id);
    if (!slug) continue;
    next[slug] = row.plan_id;
  }

  // Seed any missing entries.
  for (const [slug, planId] of Object.entries(PLAN_ASSIGNMENT_SEED)) {
    if (!(slug in next)) {
      next[slug] = planId;
    }
  }

  cache = next;
  dispatch();
}

// --- Reads -------------------------------------------------------------------

/** The plan id assigned to a client, or null when the client has no plan. */
export function getAssignedPlanId(clientId: string): string | null {
  return cache[clientId] ?? null;
}

/** The resolved Plan a client is on, or null when unassigned or the assigned
 *  plan id is no longer in the catalog. */
export function getAssignedPlan(clientId: string): Plan | null {
  const planId = cache[clientId];
  return planId ? (getPlan(planId) ?? null) : null;
}

/** Every assignment at once. Reference-stable per version. */
export function getAllPlanAssignments(): AssignmentStore {
  if (version === snapshotVersion) return snapshotValue;
  snapshotVersion = version;
  snapshotValue = { ...cache };
  return snapshotValue;
}

// --- Writes ------------------------------------------------------------------

/** Assign a client to a plan. */
export function setPlanAssignment(clientId: string, planId: string): void {
  cache = { ...cache, [clientId]: planId };
  dispatch();

  const uuid = getClientUuidBySlug(clientId);
  if (!uuid) {
    console.error('[plan-assignments] setPlanAssignment: unknown slug', clientId);
    return;
  }

  void supabase
    .from('plan_assignments')
    .upsert(
      { client_id: uuid, plan_id: planId, assigned_at: new Date().toISOString() },
      { onConflict: 'client_id' },
    )
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[plan-assignments] setPlanAssignment failed:', normalizeError(result.error).message);
      }
    });
}

/** Remove a client's plan assignment — its policy reverts to agency defaults. */
export function clearPlanAssignment(clientId: string): void {
  if (!(clientId in cache)) return;
  const next = { ...cache };
  delete next[clientId];
  cache = next;
  dispatch();

  const uuid = getClientUuidBySlug(clientId);
  if (!uuid) return;

  void supabase
    .from('plan_assignments')
    .delete()
    .eq('client_id', uuid)
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[plan-assignments] clearPlanAssignment failed:', normalizeError(result.error).message);
      }
    });
}

export function subscribePlanAssignments(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
