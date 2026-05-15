// =============================================================================
// STUB — localStorage-backed store of pages added to a website via the
// form-to-page generation flow (Session 6). Seed snapshot in
// `data-stub.tsx` is immutable; generated pages live as an overlay that
// the hub + editor merge in at read time.
//
// Key shape:
//   webnua.dev.generated-pages.{websiteId}  →  Page[] (JSON)
//
// When real backend ships, this whole module is replaced by a normal
// INSERT against the `pages` table. The public API (`getGeneratedPages`,
// `addGeneratedPage`, `mergeGeneratedPages`, `subscribeGeneratedPages`)
// stays shape-compatible — call sites don't change.
// =============================================================================

import type { Page } from './types';

const KEY_PREFIX = 'webnua.dev.generated-pages.';

function key(websiteId: string): string {
  return `${KEY_PREFIX}${websiteId}`;
}

function safeGet(k: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
}

function safeSet(k: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(k, value);
  } catch {
    // localStorage unavailable / quota
  }
}

function safeRemove(k: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(k);
  } catch {
    // localStorage unavailable
  }
}

// -- Read -------------------------------------------------------------------

export function getGeneratedPages(websiteId: string): Page[] {
  const raw = safeGet(key(websiteId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Page[];
  } catch {
    return [];
  }
}

/** Merge generated pages into a seed page list, in seed-first order.
 *  Duplicates by id are de-duped with seed winning. */
export function mergeGeneratedPages(
  websiteId: string,
  seedPages: readonly Page[],
): Page[] {
  const generated = getGeneratedPages(websiteId);
  if (generated.length === 0) return [...seedPages];
  const seedIds = new Set(seedPages.map((p) => p.id));
  const overlay = generated.filter((p) => !seedIds.has(p.id));
  return [...seedPages, ...overlay];
}

// -- Write ------------------------------------------------------------------

/** Append a generated page to the overlay for the given website. Returns
 *  the stored page (with websiteId stamped in case the caller passed a
 *  placeholder). */
export function addGeneratedPage(websiteId: string, page: Page): Page {
  const stored: Page = { ...page, websiteId };
  const current = getGeneratedPages(websiteId);
  const next = [...current, stored];
  safeSet(key(websiteId), JSON.stringify(next));
  notify();
  return stored;
}

/** Clear all generated pages for a website. Not currently called from any
 *  UI surface — exported for the dev surface and future test harnesses. */
export function clearGeneratedPages(websiteId: string): void {
  safeRemove(key(websiteId));
  notify();
}

// -- Subscription -----------------------------------------------------------

export const GENERATED_PAGES_EVENT = 'webnua:generated-pages-change';

function notify(): void {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(GENERATED_PAGES_EVENT));
  } catch {
    // event dispatch failure is non-fatal
  }
}

export function subscribeGeneratedPages(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', cb);
  window.addEventListener(GENERATED_PAGES_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(GENERATED_PAGES_EVENT, cb);
  };
}
