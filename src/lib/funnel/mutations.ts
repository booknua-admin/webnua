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
