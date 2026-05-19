// =============================================================================
// Funnel publish — write operations (Phase 4 · builder family).
//
// Lane A only: a funnel publish promotes the effective draft (draft
// funnel_version snapshot + content_drafts overlay) into a new published
// funnel_version, archives the prior published, moves the funnel pointer,
// re-bases the draft, and clears the content_drafts buffer.
//
// Funnels are operator-managed (CLAUDE.md) — there is no Lane B approval
// queue for funnels; `publishFunnelDraft` is the whole publish path.
// =============================================================================

import type { Json } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';
import { notifyBuilder } from '@/lib/website/builder-events';
import { clearDraftsForFunnel } from '@/lib/website/content-drafts';

import { fetchFunnelWithDraft } from './queries';
import type { FunnelStepSEO, FunnelVersionSnapshot } from './types';

export type FunnelPublishActor = { id: string; displayName: string };
export type FunnelPublishResult = { newVersionId: string };

export async function publishFunnelDraft(
  funnelId: string,
  actor: FunnelPublishActor,
): Promise<FunnelPublishResult | null> {
  const { funnel, draft } = await fetchFunnelWithDraft(funnelId);
  if (!funnel.draftVersionId) return null;

  const now = new Date().toISOString();
  const snapshotJson = draft.snapshot as unknown as Json;

  const { data: inserted, error: insertError } = await supabase
    .from('funnel_versions')
    .insert({
      funnel_id: funnelId,
      status: 'published',
      snapshot: snapshotJson,
      created_by: actor.id,
      created_at: now,
      published_at: now,
      published_by: actor.id,
      notes: 'Published from draft.',
      parent_version_id: funnel.publishedVersionId,
    })
    .select('id')
    .single();
  if (insertError || !inserted) return null;
  const newVersionId = inserted.id;

  if (funnel.publishedVersionId) {
    await supabase
      .from('funnel_versions')
      .update({ status: 'archived' })
      .eq('id', funnel.publishedVersionId);
  }

  await supabase
    .from('funnels')
    .update({ published_version_id: newVersionId })
    .eq('id', funnelId);
  await supabase
    .from('funnel_versions')
    .update({ snapshot: snapshotJson })
    .eq('id', funnel.draftVersionId);

  await clearDraftsForFunnel(funnelId);

  notifyBuilder();
  return { newVersionId };
}

// ---- URL slug --------------------------------------------------------------

/** Website page slugs a funnel slug must not collide with — published pages
 *  win the path (resolve.ts is page-first), so a funnel here would be
 *  unreachable. */
const RESERVED_SLUGS = new Set(['home', 'about', 'services', 'contact', '']);

export type UpdateFunnelSlugResult =
  | { ok: true; slug: string }
  | { ok: false; message: string };

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Change a funnel's URL slug. The slug is unique per client (DB constraint);
 *  a clash resolves to a friendly message rather than a thrown error. */
export async function updateFunnelSlug(
  funnelId: string,
  rawSlug: string,
): Promise<UpdateFunnelSlugResult> {
  const slug = slugify(rawSlug);
  if (!slug) {
    return { ok: false, message: 'Enter a URL — letters, numbers and dashes.' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return {
      ok: false,
      message: `“${slug}” is reserved for website pages — pick another.`,
    };
  }
  const { error } = await supabase
    .from('funnels')
    .update({ slug })
    .eq('id', funnelId);
  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'That URL is already used by another funnel.' };
    }
    return { ok: false, message: 'Could not update the URL — try again.' };
  }
  notifyBuilder();
  return { ok: true, slug };
}

// ---- SEO --------------------------------------------------------------------

/** Persist per-step SEO (title / description) onto the funnel's draft
 *  version snapshot. Same approach as the website `saveSeoForPages` —
 *  step-level SEO is not part of the content_drafts section buffer, so it
 *  writes straight to the draft baseline; buffered section edits still
 *  overlay on top. */
export async function saveSeoForSteps(
  funnelId: string,
  seoByStepId: Record<string, FunnelStepSEO>,
): Promise<boolean> {
  const { data: funnelRow, error: funnelError } = await supabase
    .from('funnels')
    .select('draft_version_id')
    .eq('id', funnelId)
    .maybeSingle();
  if (funnelError || !funnelRow?.draft_version_id) return false;
  const draftVersionId = funnelRow.draft_version_id;

  const { data, error } = await supabase
    .from('funnel_versions')
    .select('snapshot')
    .eq('id', draftVersionId)
    .maybeSingle();
  if (error || !data) return false;

  const snapshot = data.snapshot as FunnelVersionSnapshot;
  const next: FunnelVersionSnapshot = {
    ...snapshot,
    steps: snapshot.steps.map((step) => {
      const seo = seoByStepId[step.id];
      return seo ? { ...step, seo: { ...step.seo, ...seo } } : step;
    }),
  };

  const { error: writeError } = await supabase
    .from('funnel_versions')
    .update({ snapshot: next as unknown as Json })
    .eq('id', draftVersionId);
  if (writeError) return false;

  notifyBuilder();
  return true;
}
