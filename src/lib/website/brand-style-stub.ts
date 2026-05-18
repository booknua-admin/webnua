// =============================================================================
// brand-style-stub — STUB. localStorage overlay for a client's brand fonts
// (Phase 6 · section-library uplift · font editor).
//
// Fonts are brand/site-level (one heading + one body font for the whole
// site), but there is no brand-editing surface or brands-table write path
// yet — so font choices persist here, keyed by clientId, the same overlay
// pattern as the other stub stores. The editor merges this over the brand
// it resolves; the "Site fonts" menu writes to it.
//
// Replace with a brands-table UPDATE when the brand-editing surface ships.
// =============================================================================

export type BrandFontChoice = {
  headingFont?: string;
  bodyFont?: string;
};

type Store = Record<string, BrandFontChoice>;

const KEY = 'webnua.dev.brand-fonts';
const EVENT = 'webnua:brand-fonts-change';
const EMPTY: BrandFontChoice = {};

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

export function getBrandFontChoice(clientId: string): BrandFontChoice {
  return readStore()[clientId] ?? EMPTY;
}

export function setBrandFont(
  clientId: string,
  key: keyof BrandFontChoice,
  fontId: string,
): void {
  if (typeof window === 'undefined') return;
  const store = readStore();
  const next: Store = {
    ...store,
    [clientId]: { ...store[clientId], [key]: fontId },
  };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  cachedRaw = null; // force a re-read on the next getBrandFontChoice
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeBrandFonts(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
