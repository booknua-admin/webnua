// =============================================================================
// brand-style-stub — STUB. localStorage overlay for a client's brand-level
// style defaults (Phase 6 · section-library uplift · brand defaults).
//
// Holds the fonts AND the colour defaults a section inherits when it has not
// overridden a colour itself. There is no brand-editing surface / brands-
// table write path yet, so choices persist here keyed by clientId — the same
// overlay pattern as the other stub stores. The editor merges this over the
// resolved brand; the AI builder will write the same keys when it picks a
// palette.
//
// Also stores the per-browser "don't ask again" preference for the
// apply-to-all modal.
//
// Replace with a brands-table write when the brand-editing surface ships.
// =============================================================================

export type BrandStyle = {
  headingFont?: string;
  bodyFont?: string;
  headingColor?: string;
  bodyColor?: string;
  backgroundColor?: string;
};

type Store = Record<string, BrandStyle>;

const KEY = 'webnua.dev.brand-style';
const EVENT = 'webnua:brand-style-change';
const DISMISS_KEY = 'webnua.dev.apply-to-all-dismissed';
const EMPTY: BrandStyle = {};

// Snapshot cache keyed on the raw localStorage string — keeps the object
// reference stable for useSyncExternalStore (see CLAUDE.md snapshot rule).
let cachedRaw: string | null = null;
let cachedStore: Store = {};

function readStore(): Store {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(KEY);
  if (raw === cachedRaw) return cachedStore;
  cachedRaw = raw;
  try {
    cachedStore = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    cachedStore = {};
  }
  return cachedStore;
}

export function getBrandStyle(clientId: string): BrandStyle {
  return readStore()[clientId] ?? EMPTY;
}

export function setBrandStyleValue(
  clientId: string,
  key: keyof BrandStyle,
  value: string,
): void {
  if (typeof window === 'undefined') return;
  const store = readStore();
  const next: Store = {
    ...store,
    [clientId]: { ...store[clientId], [key]: value },
  };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  cachedRaw = null; // force a re-read on the next getBrandStyle
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeBrandStyle(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

// -- apply-to-all "don't ask again" -----------------------------------------

export function isApplyToAllDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISS_KEY) === '1';
}

export function dismissApplyToAll(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISS_KEY, '1');
}
