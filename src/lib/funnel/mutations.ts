// =============================================================================
// Funnel publish — write operations (Phase 4 · builder family; A3 · lanes).
//
// The publish lanes mirror `lib/website/mutations.ts` (design doc §3.3):
//   publishFunnelDraft       Lane A — promote draft → new published version.
//   submitFunnelForApproval  Lane B — write a pending_approval funnel_version
//                            + a funnel_approval_submissions row.
//   approveFunnelSubmission  operator promotes a pending version → published.
//   rejectFunnelSubmission / archive the pending version, resolve the
//   recallFunnelSubmission   submission (operator rejects / submitter recalls).
//
// A funnel publish promotes the effective draft (draft funnel_version snapshot
// + content_drafts overlay) into a new published funnel_version, archives the
// prior published, moves the funnel pointer, re-bases the draft, and clears
// the content_drafts buffer — the same correctness contract as the website.
//
// Funnels publish as a unit — the whole step sequence (snapshot.steps) goes
// live together; there is no partial-step publish. A multi-step funnel that
// threads a lead across steps would break if one step lagged the others.
// =============================================================================

import type { Json } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';
import { notifyBuilder } from '@/lib/website/builder-events';
import { clearDraftsForFunnel } from '@/lib/website/content-drafts';

import { diffFunnelSnapshots, type FunnelApprovalDiff } from './approval';
import { fetchFunnelWithDraft } from './queries';
import type { FunnelStepSEO, FunnelVersionSnapshot } from './types';

export type FunnelPublishActor = { id: string; displayName: string };
export type FunnelPublishResult = { newVersionId: string };

// ---- Internal helpers ------------------------------------------------------

async function getFunnelPointers(
  funnelId: string,
): Promise<{ draftVersionId: string | null; publishedVersionId: string | null } | null> {
  const { data, error } = await supabase
    .from('funnels')
    .select('draft_version_id, published_version_id')
    .eq('id', funnelId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    draftVersionId: data.draft_version_id,
    publishedVersionId: data.published_version_id,
  };
}

async function getPublishedFunnelSnapshot(
  publishedVersionId: string | null,
): Promise<FunnelVersionSnapshot | null> {
  if (!publishedVersionId) return null;
  const { data, error } = await supabase
    .from('funnel_versions')
    .select('snapshot')
    .eq('id', publishedVersionId)
    .maybeSingle();
  if (error || !data) return null;
  return data.snapshot as FunnelVersionSnapshot;
}

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

  // A pending submission on this funnel is now fulfilled / bypassed by a
  // direct Lane A publish — resolve it so the queue + the submitter's lock
  // clear (mirrors `publishDraft`).
  await supabase
    .from('funnel_approval_submissions')
    .update({ status: 'approved', resolved_at: now, resolved_by: actor.id })
    .eq('funnel_id', funnelId)
    .eq('status', 'pending');

  await clearDraftsForFunnel(funnelId);

  notifyBuilder();
  return { newVersionId };
}

// ---- Lane B · submit for review --------------------------------------------

export async function submitFunnelForApproval(
  funnelId: string,
  submitter: { id: string; displayName: string },
  note?: string,
): Promise<{ submissionId: string } | null> {
  const { funnel, draft } = await fetchFunnelWithDraft(funnelId);
  if (!funnel.draftVersionId) return null;

  const now = new Date().toISOString();
  const snapshotJson = draft.snapshot as unknown as Json;

  // The pending version holds the canonical snapshot — no duplicated blob.
  const { data: pendingVersion, error: versionError } = await supabase
    .from('funnel_versions')
    .insert({
      funnel_id: funnelId,
      status: 'pending_approval',
      snapshot: snapshotJson,
      created_by: submitter.id,
      created_at: now,
      notes: note ?? null,
      parent_version_id: funnel.publishedVersionId,
    })
    .select('id')
    .single();
  if (versionError || !pendingVersion) return null;

  const publishedSnapshot = await getPublishedFunnelSnapshot(
    funnel.publishedVersionId,
  );
  const diff: FunnelApprovalDiff = diffFunnelSnapshots(
    draft.snapshot,
    publishedSnapshot,
  );

  const { data: submission, error: submissionError } = await supabase
    .from('funnel_approval_submissions')
    .insert({
      funnel_id: funnelId,
      pending_funnel_version_id: pendingVersion.id,
      submitter_id: submitter.id,
      submitted_at: now,
      status: 'pending',
      note: note ?? null,
      diff: diff as unknown as Json,
    })
    .select('id')
    .single();
  if (submissionError || !submission) return null;

  notifyBuilder();
  return { submissionId: submission.id };
}

// ---- Approve / reject / recall ---------------------------------------------

type FunnelSubmissionRow = {
  id: string;
  funnel_id: string;
  pending_funnel_version_id: string;
  status: string;
};

async function fetchPendingFunnelSubmission(
  submissionId: string,
): Promise<FunnelSubmissionRow | null> {
  const { data, error } = await supabase
    .from('funnel_approval_submissions')
    .select('id, funnel_id, pending_funnel_version_id, status')
    .eq('id', submissionId)
    .maybeSingle();
  if (error || !data || data.status !== 'pending') return null;
  return data as FunnelSubmissionRow;
}

export async function approveFunnelSubmission(
  submissionId: string,
  approver: FunnelPublishActor,
): Promise<FunnelPublishResult | null> {
  const submission = await fetchPendingFunnelSubmission(submissionId);
  if (!submission) return null;

  const { data: pendingVersion } = await supabase
    .from('funnel_versions')
    .select('snapshot')
    .eq('id', submission.pending_funnel_version_id)
    .maybeSingle();
  if (!pendingVersion) return null;

  const pointers = await getFunnelPointers(submission.funnel_id);
  if (!pointers) return null;

  const now = new Date().toISOString();
  const snapshotJson = pendingVersion.snapshot as unknown as Json;

  await supabase
    .from('funnel_versions')
    .update({ status: 'published', published_at: now, published_by: approver.id })
    .eq('id', submission.pending_funnel_version_id);

  if (
    pointers.publishedVersionId &&
    pointers.publishedVersionId !== submission.pending_funnel_version_id
  ) {
    await supabase
      .from('funnel_versions')
      .update({ status: 'archived' })
      .eq('id', pointers.publishedVersionId);
  }

  await supabase
    .from('funnels')
    .update({ published_version_id: submission.pending_funnel_version_id })
    .eq('id', submission.funnel_id);
  if (pointers.draftVersionId) {
    await supabase
      .from('funnel_versions')
      .update({ snapshot: snapshotJson })
      .eq('id', pointers.draftVersionId);
  }

  await supabase
    .from('funnel_approval_submissions')
    .update({ status: 'approved', resolved_at: now, resolved_by: approver.id })
    .eq('id', submissionId);

  await clearDraftsForFunnel(submission.funnel_id);

  notifyBuilder();
  return { newVersionId: submission.pending_funnel_version_id };
}

export async function rejectFunnelSubmission(
  submissionId: string,
  approver: FunnelPublishActor,
  reason: string,
): Promise<boolean> {
  const submission = await fetchPendingFunnelSubmission(submissionId);
  if (!submission) return false;

  const now = new Date().toISOString();
  // Archive the pending version; the draft is untouched so the submitter
  // resumes editing from where they left off.
  await supabase
    .from('funnel_versions')
    .update({ status: 'archived' })
    .eq('id', submission.pending_funnel_version_id);
  await supabase
    .from('funnel_approval_submissions')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      resolved_at: now,
      resolved_by: approver.id,
    })
    .eq('id', submissionId);

  notifyBuilder();
  return true;
}

export async function recallFunnelSubmission(
  submissionId: string,
): Promise<boolean> {
  const submission = await fetchPendingFunnelSubmission(submissionId);
  if (!submission) return false;

  const now = new Date().toISOString();
  await supabase
    .from('funnel_versions')
    .update({ status: 'archived' })
    .eq('id', submission.pending_funnel_version_id);
  await supabase
    .from('funnel_approval_submissions')
    .update({ status: 'recalled', resolved_at: now })
    .eq('id', submissionId);

  notifyBuilder();
  return true;
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

// ---- Unpublish --------------------------------------------------------------

export type UnpublishFunnelResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'not_published' | 'pending_submission' };

/**
 * Pull a published funnel offline. Reverts the funnel to draft-only — the
 * public URL stops resolving (404), the draft is preserved so editing
 * continues. The previously-published version row is archived so its
 * history is still visible on the funnel detail.
 *
 * Refuses while a pending approval submission is in flight — resolving the
 * submission first keeps the operator approval queue honest (a recall by
 * the submitter or a reject/approve by the operator is the right path).
 *
 * Operator-only at the UI layer (`publish` capability + admin role); the
 * mutation itself doesn't role-check — RLS on `funnels` + auth at the
 * surface are the boundary.
 */
export async function unpublishFunnel(
  funnelId: string,
  actor: FunnelPublishActor,
): Promise<UnpublishFunnelResult> {
  const pointers = await getFunnelPointers(funnelId);
  if (!pointers) return { ok: false, reason: 'not_found' };
  if (!pointers.publishedVersionId) return { ok: false, reason: 'not_published' };

  // Refuse if a pending approval submission is in flight — the submitter
  // would lose visibility into where their submission went otherwise.
  const { data: pending } = await supabase
    .from('funnel_approval_submissions')
    .select('id')
    .eq('funnel_id', funnelId)
    .eq('status', 'pending')
    .maybeSingle();
  if (pending) return { ok: false, reason: 'pending_submission' };

  const now = new Date().toISOString();

  // Archive the previously-live version so the history list still renders it
  // (the version stays as audit; the funnel just no longer points to it).
  await supabase
    .from('funnel_versions')
    .update({ status: 'archived', notes: `Unpublished by ${actor.displayName} on ${now}.` })
    .eq('id', pointers.publishedVersionId);

  // Drop the funnel's published pointer — the public-site resolver checks
  // `funnel.published_version_id IS NULL` to return 'unpublished' (see
  // `lib/public-site/resolve.ts`).
  await supabase
    .from('funnels')
    .update({ published_version_id: null })
    .eq('id', funnelId);

  notifyBuilder();
  return { ok: true };
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
