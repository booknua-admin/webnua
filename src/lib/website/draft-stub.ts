// =============================================================================
// STUB — localStorage-backed draft store. Used by the autosave layer (see
// `use-autosave.ts`) to persist in-progress section edits between visits to
// the editor. When real backend lands, this whole module gets replaced with
// the Supabase-backed equivalent; the public API (`loadDraftSections`,
// `saveDraftSections`, `clearDraft*`, `subscribeDraft`) is shaped to survive
// that swap.
//
// Key shape (decision recorded in the Session 5 plan message):
//
//   webnua.dev.draft.{websiteId}.{pageId|header|footer}  →  Section[] (JSON)
//
// Per-page / per-singleton granularity, not a single website blob — keeps
// writes small at editor scale and makes the "operator edits header while
// client edits Home page" case naturally isolated. The trade-off is that
// publish has to wipe N+2 keys instead of one, which `clearDraftsForWebsite`
// handles by listing localStorage and filtering by the key prefix.
//
// Deletion points when Supabase ships: this file, plus the localStorage
// snapshot in `submitForApproval` / `publishDraft` (publish-stub.ts).
// =============================================================================

import type { Section } from './types';

// ---- Slot discriminator ---------------------------------------------------

export type DraftSlot =
  | { kind: 'page'; pageId: string }
  | { kind: 'header' }
  | { kind: 'footer' };

function slotSegment(slot: DraftSlot): string {
  return slot.kind === 'page' ? slot.pageId : slot.kind;
}

export function draftKey(websiteId: string, slot: DraftSlot): string {
  return `webnua.dev.draft.${websiteId}.${slotSegment(slot)}`;
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

export function loadDraft(
  websiteId: string,
  slot: DraftSlot,
): StoredDraft | null {
  const raw = safeGet(draftKey(websiteId, slot));
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
export function loadDraftSections(
  websiteId: string,
  slot: DraftSlot,
): Section[] | null {
  return loadDraft(websiteId, slot)?.sections ?? null;
}

export function saveDraftSections(
  websiteId: string,
  slot: DraftSlot,
  sections: Section[],
): boolean {
  const payload: StoredDraft = { sections, savedAt: Date.now() };
  const ok = safeSet(draftKey(websiteId, slot), JSON.stringify(payload));
  if (ok) {
    window.dispatchEvent(new Event(DRAFT_EVENT));
  }
  return ok;
}

export function clearDraft(websiteId: string, slot: DraftSlot): void {
  safeRemove(draftKey(websiteId, slot));
  window.dispatchEvent(new Event(DRAFT_EVENT));
}

/** Wipe every draft slot for a website. Called by publish-stub on a
 *  successful publish — the new published version becomes the new draft
 *  parent so any prior local draft state is stale. */
export function clearDraftsForWebsite(websiteId: string): void {
  const prefix = `webnua.dev.draft.${websiteId}.`;
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
