// =============================================================================
// override-stub — per-sub-account policy override store (Layer 3).
//
// In-memory cache hydrated from Supabase `policy_overrides`. Keyed on client
// SLUG (the public id); slug↔UUID translation happens via clients-store.
//
// Snapshot discipline (CLAUDE.md): getOverridesForClient is reference-stable —
// the parsed store is cached against a version counter.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { getClientSlugByUuid, getClientUuidBySlug } from '@/lib/clients/clients-store';
import type { PolicyKey, PolicyValueMap } from './types';

const CHANGE_EVENT = 'webnua:policy-overrides-change';

/** clientSlug → the subset of policy keys overridden for that sub-account. */
type OverrideStore = Record<string, Partial<PolicyValueMap>>;

// Seed — per-sub-account overrides that exist at platform start.
// Migrated from the former AdminClient.seatLimit field (Cluster 8 · Session 4b).
export const SUB_ACCOUNT_OVERRIDE_SEED: OverrideStore = {
  voltline: { defaultSeatLimit: 3 },
  keyhero: { defaultSeatLimit: null },
  neatworks: { defaultSeatLimit: null },
};

// --- In-memory cache ---------------------------------------------------------

let cache: OverrideStore = { ...SUB_ACCOUNT_OVERRIDE_SEED };
let version = 0;

// Stable per-client snapshot cache — only rebuilds when version changes.
const perClientVersion: Record<string, number> = {};
const perClientSnapshot: Record<string, Partial<PolicyValueMap>> = {};

const EMPTY_OVERRIDES: Readonly<Partial<PolicyValueMap>> = Object.freeze({});

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// --- Hydration ---------------------------------------------------------------

export async function hydrateOverrides(): Promise<void> {
  const { data, error } = await supabase
    .from('policy_overrides')
    .select('client_id, policy_key, value');

  if (error) {
    console.error('[override-stub] hydrate failed:', normalizeError(error).message);
    return;
  }

  // Group by slug (translate UUID → slug). Rows whose client UUID has no
  // matching slug are dropped (client not yet in cache — re-hydrate after
  // hydrateClients if needed).
  const next: OverrideStore = {};
  for (const row of data ?? []) {
    const slug = getClientSlugByUuid(row.client_id);
    if (!slug) continue;
    const key = row.policy_key as PolicyKey;
    if (!next[slug]) next[slug] = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next[slug] as any)[key] = row.value;
  }

  // Merge seed values for keys not yet in DB (non-destructive).
  for (const [slug, seedEntry] of Object.entries(SUB_ACCOUNT_OVERRIDE_SEED)) {
    for (const [key, val] of Object.entries(seedEntry) as [PolicyKey, unknown][]) {
      if (!next[slug]) next[slug] = {};
      if (!(key in next[slug])) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (next[slug] as any)[key] = val;
      }
    }
  }

  cache = next;
  dispatch();
}

// --- Reads -------------------------------------------------------------------

/** True when this sub-account overrides the agency value for this key. */
export function hasOverride(clientId: string, key: PolicyKey): boolean {
  const entry = cache[clientId];
  return entry ? key in entry : false;
}

/** The overridden value for one key, or undefined when the key is inherited. */
export function getOverride<K extends PolicyKey>(
  clientId: string,
  key: K,
): PolicyValueMap[K] | undefined {
  return cache[clientId]?.[key];
}

/** Every override for one sub-account. Reference-stable when unchanged. */
export function getOverridesForClient(
  clientId: string,
): Partial<PolicyValueMap> {
  const entry = cache[clientId];
  if (!entry) return EMPTY_OVERRIDES;

  const v = perClientVersion[clientId];
  if (v === version && perClientSnapshot[clientId]) {
    return perClientSnapshot[clientId];
  }
  perClientVersion[clientId] = version;
  perClientSnapshot[clientId] = entry;
  return entry;
}

// --- Writes ------------------------------------------------------------------

/** Override one policy key for one sub-account. */
export function setOverride<K extends PolicyKey>(
  clientId: string,
  key: K,
  value: PolicyValueMap[K],
): void {
  cache = {
    ...cache,
    [clientId]: { ...cache[clientId], [key]: value },
  };
  dispatch();

  const uuid = getClientUuidBySlug(clientId);
  if (!uuid) {
    console.error('[override-stub] setOverride: unknown slug', clientId);
    return;
  }

  void supabase
    .from('policy_overrides')
    .upsert(
      { client_id: uuid, policy_key: key, value, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,policy_key' },
    )
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[override-stub] setOverride failed:', normalizeError(result.error).message);
      }
    });
}

/** Clear one override, reverting the key to the inherited agency value. */
export function clearOverride(clientId: string, key: PolicyKey): void {
  const current = cache[clientId];
  if (!current || !(key in current)) return;
  const entry = { ...current };
  delete entry[key];
  cache = { ...cache };
  if (Object.keys(entry).length === 0) {
    delete cache[clientId];
  } else {
    cache[clientId] = entry;
  }
  dispatch();

  const uuid = getClientUuidBySlug(clientId);
  if (!uuid) return;

  void supabase
    .from('policy_overrides')
    .delete()
    .eq('client_id', uuid)
    .eq('policy_key', key)
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[override-stub] clearOverride failed:', normalizeError(result.error).message);
      }
    });
}

/** Clear every override for one sub-account. */
export function clearOverridesForClient(clientId: string): void {
  if (!(clientId in cache)) return;
  cache = { ...cache };
  delete cache[clientId];
  dispatch();

  const uuid = getClientUuidBySlug(clientId);
  if (!uuid) return;

  void supabase
    .from('policy_overrides')
    .delete()
    .eq('client_id', uuid)
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[override-stub] clearOverridesForClient failed:', normalizeError(result.error).message);
      }
    });
}

export function subscribeOverrides(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
