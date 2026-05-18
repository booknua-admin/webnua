// =============================================================================
// seat-limit — facade over the agency policy resolver + Supabase history.
//
// The effective seat limit resolves down the three layers via lib/agency/.
// This module keeps the seat-limit export surface intact and owns the
// change-history log — written to Supabase `seat_limit_changes`.
//
// Snapshot discipline (CLAUDE.md): getSeatLimitHistory() is reference-stable.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { getClientUuidBySlug, getClientSlugByUuid } from '@/lib/clients/clients-store';
import { subscribeAgencyPolicy } from '@/lib/agency/agency-policy-stub';
import {
  clearOverride,
  hasOverride,
  setOverride,
  subscribeOverrides,
} from '@/lib/agency/override-stub';
import { resolvePolicy } from '@/lib/agency/resolver';
import { subscribePlanAssignments } from '@/lib/billing/plan-assignment-stub';
import { subscribePlanCatalog } from '@/lib/billing/plan-catalog-stub';
import type { SeatLimitChange } from './seat-limit';

const HISTORY_EVENT = 'webnua:seat-limit-history-change';

// --- In-memory history cache -------------------------------------------------

type HistoryStore = Record<string, SeatLimitChange[]>;

let historyCache: HistoryStore = {};
let historyVersion = 0;

// Stable per-client snapshot
const perClientHistVersion: Record<string, number> = {};
const perClientHistSnapshot: Record<string, readonly SeatLimitChange[]> = {};
const EMPTY_HISTORY: readonly SeatLimitChange[] = Object.freeze([]);

function dispatchHistory() {
  historyVersion++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HISTORY_EVENT));
  }
}

// --- Hydration ---------------------------------------------------------------

export async function hydrateSeatLimitHistory(): Promise<void> {
  const { data, error } = await supabase
    .from('seat_limit_changes')
    .select('id, client_id, changed_by, changed_at, previous_limit, new_limit')
    .order('changed_at', { ascending: false });

  if (error) {
    console.error('[seat-limit] hydrate failed:', normalizeError(error).message);
    return;
  }

  const next: HistoryStore = {};
  for (const row of data ?? []) {
    const slug = getClientSlugByUuid(row.client_id) ?? row.client_id;
    const change: SeatLimitChange = {
      changedBy: row.changed_by ?? 'unknown',
      changedAt: row.changed_at,
      clientId: slug,
      previousLimit: row.previous_limit,
      newLimit: row.new_limit,
    };
    if (!next[slug]) next[slug] = [];
    next[slug].push(change);
  }

  historyCache = next;
  dispatchHistory();
}

// --- Effective limit (resolved) ----------------------------------------------

/** Effective seat limit for a client — resolved down the policy layers.
 *  `null` = uncapped. */
export function getSeatLimit(clientId: string): number | null {
  return resolvePolicy('defaultSeatLimit', clientId).effectiveValue;
}

/** The seat limit a client inherits when not overridden — and whether that
 *  inherited value comes from the assigned plan or the agency default. */
export function getInheritedSeatLimit(clientId: string): {
  limit: number | null;
  source: 'plan' | 'agency';
} {
  const resolved = resolvePolicy('defaultSeatLimit', clientId);
  return resolved.planValue !== undefined
    ? { limit: resolved.planValue, source: 'plan' }
    : { limit: resolved.agencyValue, source: 'agency' };
}

/** True when the client's seat limit is a per-account override, not inherited. */
export function isSeatLimitOverridden(clientId: string): boolean {
  return hasOverride(clientId, 'defaultSeatLimit');
}

// --- Change history ----------------------------------------------------------

/** Change history for a client, newest-first. Empty until the first change. */
export function getSeatLimitHistory(
  clientId: string,
): readonly SeatLimitChange[] {
  const entries = historyCache[clientId];
  if (!entries || entries.length === 0) return EMPTY_HISTORY;

  const v = perClientHistVersion[clientId];
  if (v === historyVersion && perClientHistSnapshot[clientId]) {
    return perClientHistSnapshot[clientId];
  }
  perClientHistVersion[clientId] = historyVersion;
  perClientHistSnapshot[clientId] = entries;
  return entries;
}

function recordChange(
  clientId: string,
  previousLimit: number | null,
  newLimit: number | null,
  changedBy: string,
): void {
  const change: SeatLimitChange = {
    changedBy,
    changedAt: new Date().toISOString(),
    clientId,
    previousLimit,
    newLimit,
  };

  historyCache = {
    ...historyCache,
    [clientId]: [change, ...(historyCache[clientId] ?? [])],
  };
  dispatchHistory();

  // Background write to Supabase.
  const clientUuid = getClientUuidBySlug(clientId);
  if (!clientUuid) {
    console.error('[seat-limit] recordChange: unknown slug', clientId);
    return;
  }

  void supabase
    .from('seat_limit_changes')
    .insert({
      client_id: clientUuid,
      changed_by: changedBy,
      changed_at: change.changedAt,
      previous_limit: previousLimit,
      new_limit: newLimit,
    })
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[seat-limit] recordChange INSERT failed:', normalizeError(result.error).message);
      }
    });
}

// --- Writes ------------------------------------------------------------------

/** Set a per-account seat-limit override and record the change. */
export function setSeatLimit(
  clientId: string,
  newLimit: number | null,
  changedBy: string,
): void {
  const previousLimit = getSeatLimit(clientId);
  if (previousLimit === newLimit && isSeatLimitOverridden(clientId)) return;
  setOverride(clientId, 'defaultSeatLimit', newLimit);
  recordChange(clientId, previousLimit, newLimit, changedBy);
}

/** Drop the per-account override — the client reverts to inheriting the
 *  agency default. Records the change (the effective limit may move). */
export function inheritSeatLimit(clientId: string, changedBy: string): void {
  if (!isSeatLimitOverridden(clientId)) return;
  const previousLimit = getSeatLimit(clientId);
  clearOverride(clientId, 'defaultSeatLimit');
  recordChange(clientId, previousLimit, getSeatLimit(clientId), changedBy);
}

// --- Subscriptions -----------------------------------------------------------

/** Subscribe to everything that can move a client's effective seat limit. */
export function subscribeSeatLimits(callback: () => void): () => void {
  const offOverrides = subscribeOverrides(callback);
  const offPolicy = subscribeAgencyPolicy(callback);
  const offCatalog = subscribePlanCatalog(callback);
  const offAssignments = subscribePlanAssignments(callback);
  return () => {
    offOverrides();
    offPolicy();
    offCatalog();
    offAssignments();
  };
}

/** Subscribe to seat-limit change-history writes. */
export function subscribeSeatLimitHistory(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(HISTORY_EVENT, callback);
  return () => window.removeEventListener(HISTORY_EVENT, callback);
}
