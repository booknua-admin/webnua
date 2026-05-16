// =============================================================================
// STUB — per-sub-account policy override store (Layer 3 of the model).
//
// Holds, per client (sub-account), a partial set of policy keys the agency
// default has been deliberately overridden for. A key absent from a client's
// entry means "inherit the agency value" — the override-anywhere model means
// any key CAN be overridden, but most aren't.
//
// When real auth ships, replaced by reads/writes against a
// `sub_account_policy_overrides` table; the accessor surface keeps its shape.
//
// Snapshot discipline (CLAUDE.md): the parsed store is cached keyed on the
// raw localStorage string so reads through useSyncExternalStore stay stable.
// =============================================================================

import type { PolicyKey, PolicyValueMap } from './types';

const STORE_KEY = 'webnua.dev.policy-overrides';
const CHANGE_EVENT = 'webnua:policy-overrides-change';

/** clientId → the subset of policy keys overridden for that sub-account. */
type OverrideStore = Record<string, Partial<PolicyValueMap>>;

function safeRead(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

let cacheRaw: string | null | undefined;
let cacheValue: OverrideStore = {};

function readStore(): OverrideStore {
  const raw = safeRead();
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  if (!raw) {
    cacheValue = {};
    return cacheValue;
  }
  try {
    const parsed = JSON.parse(raw) as OverrideStore;
    cacheValue = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cacheValue = {};
  }
  return cacheValue;
}

function writeStore(store: OverrideStore): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

// --- Reads --------------------------------------------------------------------

/** True when this sub-account overrides the agency value for this key. */
export function hasOverride(clientId: string, key: PolicyKey): boolean {
  const entry = readStore()[clientId];
  return entry ? key in entry : false;
}

/** The overridden value for one key, or undefined when the key is inherited. */
export function getOverride<K extends PolicyKey>(
  clientId: string,
  key: K,
): PolicyValueMap[K] | undefined {
  return readStore()[clientId]?.[key];
}

const EMPTY_OVERRIDES: Readonly<Partial<PolicyValueMap>> = Object.freeze({});

/** Every override for one sub-account. Reference-stable when there are none. */
export function getOverridesForClient(
  clientId: string,
): Partial<PolicyValueMap> {
  return readStore()[clientId] ?? EMPTY_OVERRIDES;
}

// --- Writes -------------------------------------------------------------------

/** Override one policy key for one sub-account. */
export function setOverride<K extends PolicyKey>(
  clientId: string,
  key: K,
  value: PolicyValueMap[K],
): void {
  const store = { ...readStore() };
  store[clientId] = { ...store[clientId], [key]: value };
  writeStore(store);
}

/** Clear one override, reverting the key to the inherited agency value. */
export function clearOverride(clientId: string, key: PolicyKey): void {
  const current = readStore()[clientId];
  if (!current || !(key in current)) return;
  const store = { ...readStore() };
  const entry = { ...current };
  delete entry[key];
  if (Object.keys(entry).length === 0) {
    delete store[clientId];
  } else {
    store[clientId] = entry;
  }
  writeStore(store);
}

/** Clear every override for one sub-account. */
export function clearOverridesForClient(clientId: string): void {
  const store = { ...readStore() };
  if (!(clientId in store)) return;
  delete store[clientId];
  writeStore(store);
}

export function subscribeOverrides(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
