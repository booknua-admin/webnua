// =============================================================================
// STUB — agency policy store (Layer 2 of the three-layer model).
//
// Holds the agency's HQ-wide policy values. The seed is derived from existing
// platform data (CLIENT_DEFAULTS, the admin `/settings/defaults` data); the
// localStorage overlay holds operator edits on top.
//
// When real auth ships, replaced by reads/writes against an `agency_policy`
// table; the accessor surface keeps its shape.
//
// Snapshot discipline (CLAUDE.md): readers used through useSyncExternalStore
// must be reference-stable, so the parsed overlay + the merged-all snapshot
// are cached keyed on the raw localStorage string.
// =============================================================================

import { CLIENT_DEFAULTS } from '@/lib/auth/capabilities';
import { adminDefaultsAutomations } from '@/lib/settings/admin-defaults';
import type { PolicyKey, PolicyValueMap } from './types';

const STORE_KEY = 'webnua.dev.agency-policy';
const CHANGE_EVENT = 'webnua:agency-policy-change';

// --- Seed (Layer 2 starting point) -------------------------------------------

/** The agency policy seed — derived from existing platform data so the stub
 *  starts coherent. Frozen so callers can't mutate the shared default. */
export const AGENCY_POLICY_SEED: PolicyValueMap = Object.freeze({
  defaultClientCapabilities: [...CLIENT_DEFAULTS],
  integrationDefaults: {
    // Agency-supplied shared connections vs per-sub-account own keys.
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

// --- localStorage overlay -----------------------------------------------------

function safeRead(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

let overlayCacheRaw: string | null | undefined;
let overlayCacheValue: Partial<PolicyValueMap> = {};

function readOverlay(): Partial<PolicyValueMap> {
  const raw = safeRead();
  if (raw === overlayCacheRaw) return overlayCacheValue;
  overlayCacheRaw = raw;
  if (!raw) {
    overlayCacheValue = {};
    return overlayCacheValue;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PolicyValueMap>;
    overlayCacheValue = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    overlayCacheValue = {};
  }
  return overlayCacheValue;
}

// --- Reads --------------------------------------------------------------------

/** The agency value for one policy key — overlay edit if present, else seed. */
export function getAgencyPolicy<K extends PolicyKey>(key: K): PolicyValueMap[K] {
  const overlaid = readOverlay()[key];
  return overlaid === undefined ? AGENCY_POLICY_SEED[key] : overlaid;
}

let allCacheRaw: string | null | undefined;
let allCacheValue: PolicyValueMap = AGENCY_POLICY_SEED;

/** Every agency policy value at once. Reference-stable per overlay state. */
export function getAllAgencyPolicy(): PolicyValueMap {
  const raw = safeRead();
  if (raw === allCacheRaw) return allCacheValue;
  allCacheRaw = raw;
  allCacheValue = { ...AGENCY_POLICY_SEED, ...readOverlay() };
  return allCacheValue;
}

// --- Writes -------------------------------------------------------------------

/** Set an agency policy value. Writes to the overlay; the seed is untouched. */
export function setAgencyPolicy<K extends PolicyKey>(
  key: K,
  value: PolicyValueMap[K],
): void {
  try {
    const overlay = { ...readOverlay(), [key]: value };
    window.localStorage.setItem(STORE_KEY, JSON.stringify(overlay));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

/** Drop an overlay edit, reverting a key (or all keys) to the seed value. */
export function resetAgencyPolicy(key: PolicyKey | '*'): void {
  try {
    if (key === '*') {
      window.localStorage.removeItem(STORE_KEY);
    } else {
      const overlay = { ...readOverlay() };
      delete overlay[key];
      window.localStorage.setItem(STORE_KEY, JSON.stringify(overlay));
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage unavailable — stub layer, nothing to recover.
  }
}

export function subscribeAgencyPolicy(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}
