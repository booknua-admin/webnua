// =============================================================================
// agency-policy store — in-memory cache hydrated from Supabase.
//
// Holds the agency's HQ-wide policy values (Layer 2 of the three-layer model).
// The seed is the pre-hydration fallback; Supabase rows overlay it once
// hydrateAgencyPolicy() resolves.
//
// Snapshot discipline (CLAUDE.md): getAllAgencyPolicy() is reference-stable —
// a version counter bumps on every write; the snapshot is only rebuilt when
// the version changes.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import { normalizeError } from '@/lib/errors';
import { CLIENT_DEFAULTS } from '@/lib/auth/capabilities';
import { adminDefaultsAutomations } from '@/lib/settings/admin-defaults';
import type { PolicyKey, PolicyValueMap } from './types';

const CHANGE_EVENT = 'webnua:agency-policy-change';

// --- Seed (Layer 2 starting point) -------------------------------------------

/** The agency policy seed — derived from existing platform data so the store
 *  starts coherent before hydration. Frozen so callers can't mutate it. */
export const AGENCY_POLICY_SEED: PolicyValueMap = Object.freeze({
  defaultClientCapabilities: [...CLIENT_DEFAULTS],
  integrationDefaults: {
    sharedProviders: {
      resend: true,
      twilio: true,
      'meta-ads': false,
      gbp: false,
      vercel: true,
      anthropic: true,
    },
  },
  defaultSeatLimit: 5,
  brandDefaults: {
    primaryFont: 'Inter Tight',
    monoFont: 'JetBrains Mono',
    accentColor: '#d24317',
  },
  automationDefaults: Object.fromEntries(
    adminDefaultsAutomations.map((a) => [a.id, a.defaultOn] as const),
  ),
  pricingDefaults: {
    currency: 'AUD',
    flatRateBufferPct: 15,
  },
}) as PolicyValueMap;

// --- In-memory cache ---------------------------------------------------------

/** Live overlay on top of the seed — only keys that have a DB row. */
let overlay: Partial<PolicyValueMap> = {};
let version = 0;

// Stable snapshot caches — only rebuilt when the version changes.
let snapshotVersion = -1;
let snapshotAll: PolicyValueMap = AGENCY_POLICY_SEED;

function dispatch() {
  version++;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

// --- Hydration ---------------------------------------------------------------

export async function hydrateAgencyPolicy(): Promise<void> {
  const { data, error } = await supabase
    .from('agency_policy')
    .select('policy_key, value');

  if (error) {
    console.error('[agency-policy] hydrate failed:', normalizeError(error).message);
    return;
  }

  const next: Partial<PolicyValueMap> = {};
  for (const row of data ?? []) {
    const key = row.policy_key as PolicyKey;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next as any)[key] = row.value;
  }
  overlay = next;
  dispatch();
}

// --- Reads -------------------------------------------------------------------

/** The agency value for one policy key — DB overlay if present, else seed. */
export function getAgencyPolicy<K extends PolicyKey>(key: K): PolicyValueMap[K] {
  const overlaid = overlay[key];
  return overlaid === undefined ? AGENCY_POLICY_SEED[key] : overlaid;
}

/** Every agency policy value at once. Reference-stable per version. */
export function getAllAgencyPolicy(): PolicyValueMap {
  if (version === snapshotVersion) return snapshotAll;
  snapshotVersion = version;
  snapshotAll = { ...AGENCY_POLICY_SEED, ...overlay };
  return snapshotAll;
}

// --- Writes ------------------------------------------------------------------

/** Set an agency policy value. Optimistic cache update + Supabase UPSERT. */
export function setAgencyPolicy<K extends PolicyKey>(
  key: K,
  value: PolicyValueMap[K],
): void {
  overlay = { ...overlay, [key]: value };
  dispatch();

  // Background write — fire and forget.
  void supabase
    .from('agency_policy')
    .upsert({ policy_key: key, value, updated_at: new Date().toISOString() }, { onConflict: 'policy_key' })
    .then((result: { error: unknown }) => {
      if (result.error) {
        console.error('[agency-policy] setAgencyPolicy failed:', normalizeError(result.error).message);
      }
    });
}

/** Drop an overlay edit, reverting a key (or all keys) to the seed value. */
export function resetAgencyPolicy(key: PolicyKey | '*'): void {
  if (key === '*') {
    overlay = {};
    dispatch();
    void supabase
      .from('agency_policy')
      .delete()
      .not('policy_key', 'is', null) // delete all rows (policy_key is the PK)
      .then((result: { error: unknown }) => {
        if (result.error) {
          console.error('[agency-policy] resetAgencyPolicy(*) failed:', normalizeError(result.error).message);
        }
      });
  } else {
    const next = { ...overlay };
    delete next[key];
    overlay = next;
    dispatch();
    void supabase
      .from('agency_policy')
      .delete()
      .eq('policy_key', key)
      .then((result: { error: unknown }) => {
        if (result.error) {
          console.error('[agency-policy] resetAgencyPolicy failed:', normalizeError(result.error).message);
        }
      });
  }
}

export function subscribeAgencyPolicy(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}
