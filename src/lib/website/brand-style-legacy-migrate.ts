// =============================================================================
// brand-style-legacy-migrate — one-shot migration of pre-sunset localStorage
// brand-style data into the `brands` table.
//
// Customers may carry `webnua.dev.brand-style` (the old stub key) in their
// browser from earlier sessions. On first SectionEditor mount post-sunset
// for a given clientSlug, this:
//
//   1. Reads the legacy entry for THAT clientSlug
//   2. Writes each present field to the brands row (via setBrandStyleValue)
//   3. Removes that clientSlug's entry from the legacy blob (others stay
//      until they're encountered by their own editor mounts)
//
// Multi-tenant safe (per-client migration), idempotent (a second mount sees
// no legacy entry and no-ops), and observable (logs the migration to
// console so operators debugging a customer report can confirm).
//
// Delete this module + its sole caller in SectionEditor when telemetry says
// the legacy key is gone in the wild.
// =============================================================================

import { setBrandStyleValue, type BrandStyleKey } from './brand-style';

const LEGACY_KEY = 'webnua.dev.brand-style';
const MIGRATED_MARKER = 'webnua.brand-style.legacy-migrated';

type LegacyStore = Record<string, Partial<Record<BrandStyleKey, string>>>;

const ALL_KEYS: BrandStyleKey[] = [
  'headingFont',
  'bodyFont',
  'headingColor',
  'bodyColor',
  'backgroundColor',
];

/**
 * Migrate legacy localStorage brand-style data for the given client slug.
 * Idempotent — safe to call on every editor mount; no-ops when there's
 * nothing to migrate.
 */
export function migrateLegacyBrandStyle(clientSlug: string): void {
  if (typeof window === 'undefined' || !clientSlug) return;

  // Per-tab memoisation — even if SectionEditor remounts repeatedly for the
  // same client this session, we only attempt the migration once.
  const marker = `${MIGRATED_MARKER}:${clientSlug}`;
  if (window.sessionStorage.getItem(marker) === '1') return;
  window.sessionStorage.setItem(marker, '1');

  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return;

  let store: LegacyStore;
  try {
    store = JSON.parse(raw) as LegacyStore;
  } catch {
    // Malformed blob — clear it so it doesn't linger.
    window.localStorage.removeItem(LEGACY_KEY);
    return;
  }

  const entry = store[clientSlug];
  if (!entry || typeof entry !== 'object') return;

  const fields: Array<[BrandStyleKey, string]> = [];
  for (const key of ALL_KEYS) {
    const value = entry[key];
    if (typeof value === 'string' && value.length > 0) {
      fields.push([key, value]);
    }
  }
  if (fields.length === 0) {
    // Entry existed but had no usable fields — drop it.
    delete store[clientSlug];
    persist(store);
    return;
  }

  for (const [key, value] of fields) {
    setBrandStyleValue(clientSlug, key, value);
  }
  console.info(
    `[brand-style] migrated ${fields.length} legacy localStorage field(s) for "${clientSlug}" → brands table:`,
    fields.map(([k]) => k).join(', '),
  );

  delete store[clientSlug];
  persist(store);
}

function persist(store: LegacyStore): void {
  if (Object.keys(store).length === 0) {
    window.localStorage.removeItem(LEGACY_KEY);
  } else {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(store));
  }
}
