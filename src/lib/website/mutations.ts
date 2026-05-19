// =============================================================================
// Website publish family — write operations (Phase 4 · builder family).
//
// Replaces the localStorage `publish-stub`. Each operation is an async
// function over Supabase; on success it fires `BUILDER_EVENT` so every
// dependent query refetches. All return `null` on failure (no draft, RLS
// rejection, …) — call sites keep their `if (result)` contract.
//
// The publish lanes (design doc §3.3):
//   publishDraft        Lane A — promote draft → new published version.
//   submitForApproval   Lane B — write a pending_approval version + a
//                       website_approval_submissions row.
//   approveSubmission   operator promotes a pending version → published.
//   rejectSubmission /  archive the pending version, resolve the submission.
//   recallSubmission
//   restoreVersionAsDraft  copy a prior version's snapshot into the draft.
//
// Correctness vs the stub (see /tmp/phase4-benchmark.md): on publish /
// approve / restore the single draft version row's snapshot is updated to
// the new baseline, so the editor reflects what just went live (the stub
// left the draft stale).
// =============================================================================

import type { Json } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';
import type { WebsiteApprovalDiff } from '@/lib/tickets/website-approval-stub';

import { notifyBuilder } from './builder-events';
import { clearDraftsForWebsite } from './content-drafts';
import { fetchEffectiveDraft } from './queries';
import { diffSnapshots } from './snapshot';
import type { PageSEO, VersionSnapshot } from './types';

export type PublishActor = {
  id: string;
  displayName: string;
  email?: string;
};

export type PublishOptions = {
  /** Break-glass force-publish — writes a force_publish_audit_log row. */
  force?: { reason: string };
};

export type PublishResult = { newVersionId: string };

// ---- Internal helpers -----------------------------------------------------

async function getPublishedSnapshot(
  publishedVersionId: string | null,
): Promise<VersionSnapshot | null> {
  if (!publishedVersionId) return null;
  const { data, error } = await supabase
    .from('website_versions')
    .select('snapshot')
    .eq('id', publishedVersionId)
    .maybeSingle();
  if (error || !data) return null;
  return data.snapshot as VersionSnapshot;
}

async function getWebsitePointers(
  websiteId: string,
): Promise<{ draftVersionId: string | null; publishedVersionId: string | null } | null> {
  const { data, error } = await supabase
    .from('websites')
    .select('draft_version_id, published_version_id')
    .eq('id', websiteId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    draftVersionId: data.draft_version_id,
    publishedVersionId: data.published_version_id,
  };
}

// ---- Lane A · publish -----------------------------------------------------

export async function publishDraft(
  websiteId: string,
  actor: PublishActor,
  options: PublishOptions = {},
): Promise<PublishResult | null> {
  const eff = await fetchEffectiveDraft(websiteId);
  if (!eff) return null;
  const pointers = await getWebsitePointers(websiteId);
  if (!pointers) return null;

  const now = new Date().toISOString();
  const snapshotJson = eff.snapshot as unknown as Json;

  // New published version.
  const { data: inserted, error: insertError } = await supabase
    .from('website_versions')
    .insert({
      website_id: websiteId,
      status: 'published',
      snapshot: snapshotJson,
      created_by: actor.id,
      created_at: now,
      published_at: now,
      published_by: actor.id,
      notes: options.force
        ? `Force publish · ${options.force.reason}`
        : 'Published from draft.',
      parent_version_id: pointers.publishedVersionId,
    })
    .select('id')
    .single();
  if (insertError || !inserted) return null;
  const newVersionId = inserted.id;

  // Archive the prior published version.
  if (pointers.publishedVersionId) {
    await supabase
      .from('website_versions')
      .update({ status: 'archived' })
      .eq('id', pointers.publishedVersionId);
  }

  // Move the live pointer + re-base the draft on the new published snapshot.
  await supabase
    .from('websites')
    .update({ published_version_id: newVersionId })
    .eq('id', websiteId);
  if (pointers.draftVersionId) {
    await supabase
      .from('website_versions')
      .update({ snapshot: snapshotJson })
      .eq('id', pointers.draftVersionId);
  }

  // A pending submission on this website is now fulfilled/bypassed.
  await supabase
    .from('website_approval_submissions')
    .update({
      status: 'approved',
      resolved_at: now,
      resolved_by: actor.id,
    })
    .eq('website_id', websiteId)
    .eq('status', 'pending');

  await clearDraftsForWebsite(websiteId);

  if (options.force) {
    await supabase.from('force_publish_audit_log').insert({
      actor_user_id: actor.id,
      website_id: websiteId,
      new_version_id: newVersionId,
      reason: options.force.reason,
      created_at: now,
    });
  }

  notifyBuilder();
  return { newVersionId };
}

// ---- Lane B · submit for review -------------------------------------------

export async function submitForApproval(
  websiteId: string,
  submitter: { id: string; displayName: string },
  note?: string,
): Promise<{ submissionId: string } | null> {
  const eff = await fetchEffectiveDraft(websiteId);
  if (!eff) return null;
  const pointers = await getWebsitePointers(websiteId);
  if (!pointers) return null;

  const now = new Date().toISOString();
  const snapshotJson = eff.snapshot as unknown as Json;

  const { data: pendingVersion, error: versionError } = await supabase
    .from('website_versions')
    .insert({
      website_id: websiteId,
      status: 'pending_approval',
      snapshot: snapshotJson,
      created_by: submitter.id,
      created_at: now,
      notes: note ?? null,
      parent_version_id: pointers.publishedVersionId,
    })
    .select('id')
    .single();
  if (versionError || !pendingVersion) return null;

  const publishedSnapshot = await getPublishedSnapshot(
    pointers.publishedVersionId,
  );
  const diff: WebsiteApprovalDiff = diffSnapshots(
    eff.snapshot,
    publishedSnapshot,
  );

  const { data: submission, error: submissionError } = await supabase
    .from('website_approval_submissions')
    .insert({
      website_id: websiteId,
      pending_version_id: pendingVersion.id,
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

// ---- Approve / reject / recall --------------------------------------------

type SubmissionRow = {
  id: string;
  website_id: string;
  pending_version_id: string;
  status: string;
};

async function fetchPendingSubmission(
  submissionId: string,
): Promise<SubmissionRow | null> {
  const { data, error } = await supabase
    .from('website_approval_submissions')
    .select('id, website_id, pending_version_id, status')
    .eq('id', submissionId)
    .maybeSingle();
  if (error || !data || data.status !== 'pending') return null;
  return data as SubmissionRow;
}

export async function approveSubmission(
  submissionId: string,
  approver: PublishActor,
): Promise<PublishResult | null> {
  const submission = await fetchPendingSubmission(submissionId);
  if (!submission) return null;

  const { data: pendingVersion } = await supabase
    .from('website_versions')
    .select('snapshot')
    .eq('id', submission.pending_version_id)
    .maybeSingle();
  if (!pendingVersion) return null;

  const pointers = await getWebsitePointers(submission.website_id);
  if (!pointers) return null;

  const now = new Date().toISOString();
  const snapshotJson = pendingVersion.snapshot as unknown as Json;

  await supabase
    .from('website_versions')
    .update({
      status: 'published',
      published_at: now,
      published_by: approver.id,
    })
    .eq('id', submission.pending_version_id);

  if (
    pointers.publishedVersionId &&
    pointers.publishedVersionId !== submission.pending_version_id
  ) {
    await supabase
      .from('website_versions')
      .update({ status: 'archived' })
      .eq('id', pointers.publishedVersionId);
  }

  await supabase
    .from('websites')
    .update({ published_version_id: submission.pending_version_id })
    .eq('id', submission.website_id);
  if (pointers.draftVersionId) {
    await supabase
      .from('website_versions')
      .update({ snapshot: snapshotJson })
      .eq('id', pointers.draftVersionId);
  }

  await supabase
    .from('website_approval_submissions')
    .update({ status: 'approved', resolved_at: now, resolved_by: approver.id })
    .eq('id', submissionId);

  await clearDraftsForWebsite(submission.website_id);

  notifyBuilder();
  return { newVersionId: submission.pending_version_id };
}

export async function rejectSubmission(
  submissionId: string,
  approver: PublishActor,
  reason: string,
): Promise<boolean> {
  const submission = await fetchPendingSubmission(submissionId);
  if (!submission) return false;

  const now = new Date().toISOString();
  await supabase
    .from('website_versions')
    .update({ status: 'archived' })
    .eq('id', submission.pending_version_id);
  await supabase
    .from('website_approval_submissions')
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

export async function recallSubmission(
  submissionId: string,
): Promise<boolean> {
  const submission = await fetchPendingSubmission(submissionId);
  if (!submission) return false;

  const now = new Date().toISOString();
  await supabase
    .from('website_versions')
    .update({ status: 'archived' })
    .eq('id', submission.pending_version_id);
  await supabase
    .from('website_approval_submissions')
    .update({ status: 'recalled', resolved_at: now })
    .eq('id', submissionId);

  notifyBuilder();
  return true;
}

// ---- Restore (rollback) ---------------------------------------------------

export async function restoreVersionAsDraft(
  websiteId: string,
  sourceVersionId: string,
  actor: PublishActor,
): Promise<{ newDraftId: string } | null> {
  const { data: source, error: sourceError } = await supabase
    .from('website_versions')
    .select('snapshot, website_id')
    .eq('id', sourceVersionId)
    .maybeSingle();
  if (sourceError || !source || source.website_id !== websiteId) return null;

  // Refuse while a pending submission is in flight — restore would silently
  // overwrite the submitter's diff.
  const { count } = await supabase
    .from('website_approval_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('website_id', websiteId)
    .eq('status', 'pending');
  if ((count ?? 0) > 0) return null;

  const pointers = await getWebsitePointers(websiteId);
  if (!pointers?.draftVersionId) return null;

  await supabase
    .from('website_versions')
    .update({
      snapshot: source.snapshot,
      created_by: actor.id,
      notes: `Restored from version ${sourceVersionId}`,
    })
    .eq('id', pointers.draftVersionId);

  await clearDraftsForWebsite(websiteId);

  notifyBuilder();
  return { newDraftId: pointers.draftVersionId };
}

// ---- SEO --------------------------------------------------------------------

/** Persist per-page SEO (title / description) onto the draft version's
 *  snapshot. SEO is a Page-level field — not part of the content_drafts
 *  section buffer — so it writes straight to the draft baseline.
 *  `mergeDraftsIntoSnapshot` only overlays `sections`, leaving `page.seo`
 *  intact, so buffered section edits are safe across this write. */
export async function saveSeoForPages(
  websiteId: string,
  seoByPageId: Record<string, PageSEO>,
): Promise<boolean> {
  const pointers = await getWebsitePointers(websiteId);
  if (!pointers?.draftVersionId) return false;

  const { data, error } = await supabase
    .from('website_versions')
    .select('snapshot')
    .eq('id', pointers.draftVersionId)
    .maybeSingle();
  if (error || !data) return false;

  const snapshot = data.snapshot as VersionSnapshot;
  const next: VersionSnapshot = {
    ...snapshot,
    pages: snapshot.pages.map((page) => {
      const seo = seoByPageId[page.id];
      return seo ? { ...page, seo: { ...page.seo, ...seo } } : page;
    }),
  };

  const { error: writeError } = await supabase
    .from('website_versions')
    .update({ snapshot: next as unknown as Json })
    .eq('id', pointers.draftVersionId);
  if (writeError) return false;

  notifyBuilder();
  return true;
}
