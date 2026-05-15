// =============================================================================
// STUB — localStorage-backed draft store. Used by the autosave layer (see
// `use-autosave.ts`) to persist in-progress section edits between visits to
// the editor. When real backend lands, this whole module gets replaced with
// the Supabase-backed equivalent; the public API (`loadDraftSections`,
// `saveDraftSections`, `clearDraft*`, `subscribeDraft`) is shaped to survive
// that swap.
//
// Key shape:
//
//   webnua.dev.draft.{websiteId}.{pageId|header|footer}      →  Section[] (JSON)
//   webnua.dev.draft.funnel.{funnelId}.{stepId}              →  Section[] (JSON)
//
// Per-page / per-singleton / per-funnel-step granularity, not a single
// blob — keeps writes small at editor scale and makes concurrent edits
// across surfaces naturally isolated. The trade-off is that publish has
// to wipe N keys instead of one, which `clearDraftsForWebsite` /
// `clearDraftsForFunnel` handle by prefix-scanning localStorage.
//
// Session 7 added the `funnelStep` slot kind alongside the website slots.
// The DraftSlot itself now carries its scope id (websiteId or funnelId) so
// helpers take a single slot argument.
//
// Deletion points when Supabase ships: this file, plus the localStorage
// snapshot in `submitForApproval` / `publishDraft` (publish-stub.ts).
// =============================================================================

import type { Section } from './types';

// ---- Slot discriminator ---------------------------------------------------

export type DraftSlot =
  | { kind: 'page'; websiteId: string; pageId: string }
  | { kind: 'header'; websiteId: string }
  | { kind: 'footer'; websiteId: string }
  | { kind: 'funnelStep'; funnelId: string; stepId: string };

export function draftKey(slot: DraftSlot): string {
  switch (slot.kind) {
    case 'page':
      return `webnua.dev.draft.${slot.websiteId}.${slot.pageId}`;
    case 'header':
      return `webnua.dev.draft.${slot.websiteId}.header`;
    case 'footer':
      return `webnua.dev.draft.${slot.websiteId}.footer`;
    case 'funnelStep':
      return `webnua.dev.draft.funnel.${slot.funnelId}.${slot.stepId}`;
  }
}

// ---- Stored shape ---------------------------------------------------------

type StoredDraft = {
  sections: Section[];
  /** ms epoch — used by the autosave indicator's "Saved N ago" text. */
  savedAt: number;
};

// ---- Read / write ---------------------------------------------------------

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // localStorage unavailable
  }
}

export function loadDraft(slot: DraftSlot): StoredDraft | null {
  const raw = safeGet(draftKey(slot));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!Array.isArray(parsed.sections)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Convenience accessor used by SectionEditor's initial-state seeding. */
export function loadDraftSections(slot: DraftSlot): Section[] | null {
  return loadDraft(slot)?.sections ?? null;
}

export function saveDraftSections(
  slot: DraftSlot,
  sections: Section[],
): boolean {
  const payload: StoredDraft = { sections, savedAt: Date.now() };
  const ok = safeSet(draftKey(slot), JSON.stringify(payload));
  if (ok) {
    window.dispatchEvent(new Event(DRAFT_EVENT));
  }
  return ok;
}

export function clearDraft(slot: DraftSlot): void {
  safeRemove(draftKey(slot));
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

function clearByPrefix(prefix: string): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) toRemove.push(key);
    }
    for (const key of toRemove) window.localStorage.removeItem(key);
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    // localStorage unavailable
  }
}

/** Wipe every draft slot for a website. Called by publish-stub on a
 *  successful publish — the new published version becomes the new draft
 *  parent so any prior local draft state is stale. */
export function clearDraftsForWebsite(websiteId: string): void {
  clearByPrefix(`webnua.dev.draft.${websiteId}.`);
}

/** Wipe every draft slot for a funnel. Funnel publish lands in a later
 *  session; this helper is here for symmetry and for the funnel editor's
 *  "Discard draft" path. */
export function clearDraftsForFunnel(funnelId: string): void {
  clearByPrefix(`webnua.dev.draft.funnel.${funnelId}.`);
}

// ---- Subscription ---------------------------------------------------------
//
// Same event-bus pattern as user-stub: one custom event for in-tab updates
// plus the native `storage` event for cross-tab. Components subscribe via
// useSyncExternalStore to render reactively when a draft key changes.

export const DRAFT_EVENT = 'webnua:draft-change';

export function subscribeDraft(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(DRAFT_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(DRAFT_EVENT, callback);
  };
}
