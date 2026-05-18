// =============================================================================
// content_drafts — the autosave write-buffer (Phase 4, was draft-stub.ts).
//
// A transient per-page / per-singleton / per-funnel-step buffer that overlays
// the draft version's baseline snapshot. One row per editable scope, keyed by
// the (scope_kind, website_id, funnel_id, page_key) unique constraint
// (NULLS NOT DISTINCT — so the null funnel_id / null page_key collapse).
//
// `updated_by` must equal the signed-in user (RLS) — the buffer is the user's
// own unsaved work. Publish / approve clears the website's whole buffer.
// =============================================================================

import { supabase } from '@/lib/supabase/client';
import type { Section } from './types';

// ---- Slot discriminator (unchanged shape from the stub) -------------------

export type DraftSlot =
  | { kind: 'page'; websiteId: string; pageId: string }
  | { kind: 'header'; websiteId: string }
  | { kind: 'footer'; websiteId: string }
  | { kind: 'funnelStep'; funnelId: string; stepId: string };

type DraftScopeKind = 'page' | 'header' | 'footer' | 'funnel_step';

type SlotColumns = {
  scope_kind: DraftScopeKind;
  website_id: string | null;
  funnel_id: string | null;
  page_key: string | null;
};

function slotColumns(slot: DraftSlot): SlotColumns {
  switch (slot.kind) {
    case 'page':
      return {
        scope_kind: 'page',
        website_id: slot.websiteId,
        funnel_id: null,
        page_key: slot.pageId,
      };
    case 'header':
      return {
        scope_kind: 'header',
        website_id: slot.websiteId,
        funnel_id: null,
        page_key: null,
      };
    case 'footer':
      return {
        scope_kind: 'footer',
        website_id: slot.websiteId,
        funnel_id: null,
        page_key: null,
      };
    case 'funnelStep':
      return {
        scope_kind: 'funnel_step',
        website_id: null,
        funnel_id: slot.funnelId,
        page_key: slot.stepId,
      };
  }
}

// ---- Draft row (for the snapshot merge) -----------------------------------

export type DraftRow = {
  scopeKind: DraftScopeKind;
  pageKey: string | null;
  sections: Section[];
};

// ---- Reads ----------------------------------------------------------------

/** Every content_drafts row for a website — the per-page / header / footer
 *  overlay. Used to build the effective draft snapshot. */
export async function loadDraftsForWebsite(
  websiteId: string,
): Promise<DraftRow[]> {
  const { data, error } = await supabase
    .from('content_drafts')
    .select('scope_kind, page_key, sections')
    .eq('website_id', websiteId);
  if (error || !data) return [];
  return data.map((r) => ({
    scopeKind: r.scope_kind as DraftScopeKind,
    pageKey: r.page_key,
    sections: (r.sections as unknown as Section[]) ?? [],
  }));
}

/** Every content_drafts row for a funnel. */
export async function loadDraftsForFunnel(
  funnelId: string,
): Promise<DraftRow[]> {
  const { data, error } = await supabase
    .from('content_drafts')
    .select('scope_kind, page_key, sections')
    .eq('funnel_id', funnelId);
  if (error || !data) return [];
  return data.map((r) => ({
    scopeKind: r.scope_kind as DraftScopeKind,
    pageKey: r.page_key,
    sections: (r.sections as unknown as Section[]) ?? [],
  }));
}

/** The sections buffered for one slot, or null if nothing buffered. */
export async function loadDraftSections(
  slot: DraftSlot,
): Promise<Section[] | null> {
  const cols = slotColumns(slot);
  let query = supabase
    .from('content_drafts')
    .select('sections')
    .eq('scope_kind', cols.scope_kind);
  query = cols.website_id
    ? query.eq('website_id', cols.website_id)
    : query.is('website_id', null);
  query = cols.funnel_id
    ? query.eq('funnel_id', cols.funnel_id)
    : query.is('funnel_id', null);
  query = cols.page_key
    ? query.eq('page_key', cols.page_key)
    : query.is('page_key', null);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return (data.sections as unknown as Section[]) ?? null;
}

// ---- Writes ---------------------------------------------------------------

/** Upsert one slot's sections. Returns false if not signed in or on error. */
export async function saveDraftSections(
  slot: DraftSlot,
  sections: Section[],
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const cols = slotColumns(slot);
  const { error } = await supabase
    .from('content_drafts')
    .upsert(
      {
        ...cols,
        sections: sections as unknown as never,
        saved_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: 'scope_kind,website_id,funnel_id,page_key' },
    );
  return !error;
}

/** Wipe every draft slot for a website (called on publish / approve). */
export async function clearDraftsForWebsite(websiteId: string): Promise<void> {
  await supabase.from('content_drafts').delete().eq('website_id', websiteId);
}

/** Wipe every draft slot for a funnel. */
export async function clearDraftsForFunnel(funnelId: string): Promise<void> {
  await supabase.from('content_drafts').delete().eq('funnel_id', funnelId);
}
