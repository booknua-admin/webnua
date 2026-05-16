// =============================================================================
// STUB — per-client seat-limit store.
//
// The seed limit lives on AdminClient.seatLimit (lib/nav/admin-clients.ts).
// This store holds operator overrides + the full change history. The effective
// limit for a client is its override entry's limit if one exists, else the
// seed. `null` = unconfigured = uncapped.
//
// When real auth ships, replaced by reads/writes against a `clients` column
// (current limit) + a `seat_limit_changes` table (history); the accessor
// surface keeps its shape.
//
// Snapshot discipline (CLAUDE.md): getSnapshot must be reference-stable, so
// the parsed blob is cached keyed on the raw localStorage string.
// =============================================================================

import { adminClients } from '@/lib/nav/admin-clients';
import type { SeatLimitChange } from './seat-limit';

const STORE_KEY = 'webnua.dev.seat-limits';
const CHANGE_EVENT = 'webnua:seat-limits-change';

type SeatLimitEntry = {
  limit: number | null;
  history: SeatLimitChange[];
};
type SeatLimitStore = Record<string, SeatLimitEntry>;

function safeRead(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

let cacheRaw: string | null = null;
let cacheValue: SeatLimitStore = {};

function readStore(): SeatLimitStore {
  const raw = safeRead();
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  if (!raw) {
    cacheValue = {};
    return cacheValue;
  }
  try {
    const parsed = JSON.parse(raw) as SeatLimitStore;
    cacheValue = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cacheValue = {};
  }
  return cacheValue;
}

/** Seed seat limit from the static client record. */
function seedLimit(clientId: string): number | null {
  return adminClients.find((c) => c.id === clientId)?.seatLimit ?? null;
}

/** Effective seat limit for a client — override if set, else the seed. */
export function getSeatLimit(clientId: string): number | null {
  const entry = readStore()[clientId];
  return entry ? entry.limit : seedLimit(clientId);
}

/** Change history for a client, newest-first. Empty until the first override. */
export function getSeatLimitHistory(clientId: string): SeatLimitChange[] {
  return readStore()[clientId]?.history ?? [];
}

/** Set a new seat limit and record the change as an attributable event. */
export function setSeatLimit(
  clientId: string,
  newLimit: number | null,
  changedBy: string,
): void {
  const previousLimit = getSeatLimit(clientId);
  if (previousLimit === newLimit) return;
  try {
    const store = { ...readStore() };
    const prevHistory = store[clientId]?.history ?? [];
    const change: SeatLimitChange = {
      changedBy,
      changedAt: new Date().toISOString(),
      clientId,
      previousLimit,
      newLimit,
    };
    store[clientId] = { limit: newLimit, history: [change, ...prevHistory] };
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

export function subscribeSeatLimits(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
