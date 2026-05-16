// =============================================================================
// STUB — seat-limit facade over the agency policy resolver.
//
// Cluster 8 · Session 4b: the seat limit is a policy key (`defaultSeatLimit`),
// not a standalone store. The effective limit for a client resolves down the
// three layers via lib/agency/ —
//   Layer 2 : agency default        — set on /settings/seats
//   Layer 3 : per-sub-account override — override-stub (seeded from the
//             former AdminClient.seatLimit values)
//
// This module is the seat-limit-specific facade: it keeps the export surface
// the rest of the app already uses (getSeatLimit / setSeatLimit / …) and owns
// the change-history log — an attributable audit trail (vision §7) that the
// generic override store does not track.
//
// When real auth ships, the resolver swaps to Supabase reads and this history
// log becomes a `seat_limit_changes` table; the accessor surface is unchanged.
//
// Snapshot discipline (CLAUDE.md): the parsed history blob is cached keyed on
// the raw localStorage string so reads through useSyncExternalStore stay
// reference-stable.
// =============================================================================

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

const HISTORY_KEY = 'webnua.dev.seat-limit-history';
const HISTORY_EVENT = 'webnua:seat-limit-history-change';

// --- Effective limit (resolved) ----------------------------------------------

/** Effective seat limit for a client — resolved down the policy layers.
 *  `null` = uncapped. */
export function getSeatLimit(clientId: string): number | null {
  return resolvePolicy('defaultSeatLimit', clientId).effectiveValue;
}

/** The seat limit a client inherits when not overridden — and whether that
 *  inherited value comes from the assigned plan or the agency default. The
 *  plan layer (Cluster 9 · Session 1) sits between the two: a client on a plan
 *  that sets a seat limit inherits the plan's value, not the agency's. */
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

type HistoryStore = Record<string, SeatLimitChange[]>;

function safeReadHistory(): string | null {
  try {
    return window.localStorage.getItem(HISTORY_KEY);
  } catch {
    return null;
  }
}

let historyCacheRaw: string | null | undefined;
let historyCacheValue: HistoryStore = {};

function readHistory(): HistoryStore {
  const raw = safeReadHistory();
  if (raw === historyCacheRaw) return historyCacheValue;
  historyCacheRaw = raw;
  if (!raw) {
    historyCacheValue = {};
    return historyCacheValue;
  }
  try {
    const parsed = JSON.parse(raw) as HistoryStore;
    historyCacheValue = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    historyCacheValue = {};
  }
  return historyCacheValue;
}

// Shared empty array — getSeatLimitHistory is read through useSyncExternalStore
// so it MUST be reference-stable when there is no history (CLAUDE.md).
const EMPTY_HISTORY: readonly SeatLimitChange[] = Object.freeze([]);

/** Change history for a client, newest-first. Empty until the first change. */
export function getSeatLimitHistory(
  clientId: string,
): readonly SeatLimitChange[] {
  return readHistory()[clientId] ?? EMPTY_HISTORY;
}

function recordChange(
  clientId: string,
  previousLimit: number | null,
  newLimit: number | null,
  changedBy: string,
): void {
  try {
    const store = { ...readHistory() };
    const change: SeatLimitChange = {
      changedBy,
      changedAt: new Date().toISOString(),
      clientId,
      previousLimit,
      newLimit,
    };
    store[clientId] = [change, ...(store[clientId] ?? [])];
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(HISTORY_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

// --- Writes ------------------------------------------------------------------

/** Set a per-account seat-limit override and record the change. */
export function setSeatLimit(
  clientId: string,
  newLimit: number | null,
  changedBy: string,
): void {
  const previousLimit = getSeatLimit(clientId);
  // No-op only when the value is unchanged AND already an explicit override —
  // setting the same value on an inherited client is still a real change
  // (inherited → overridden).
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

function subscribeHistory(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(HISTORY_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(HISTORY_EVENT, callback);
  };
}

/** Subscribe to everything that can move a client's effective seat limit —
 *  the agency default (Layer 2), the assigned plan (Layer 2.5 — catalog edits
 *  + reassignment), and per-account overrides (Layer 3). */
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
  return subscribeHistory(callback);
}
