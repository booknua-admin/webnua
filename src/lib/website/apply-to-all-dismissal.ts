// =============================================================================
// apply-to-all-dismissal — per-browser "don't ask again" preference for the
// ApplyToAllModal that surfaces after an in-section colour change.
//
// This is a UX preference, NOT brand data — it belongs per-browser, not in
// the database. Sibling of the brand-style write path, kept separate so the
// brand-style sunset doesn't entangle a real preference.
//
// Was: `isApplyToAllDismissed` / `dismissApplyToAll` in brand-style-stub.ts.
// =============================================================================

const KEY = 'webnua.apply-to-all-dismissed';

export function isApplyToAllDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(KEY) === '1';
}

export function dismissApplyToAll(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, '1');
}
