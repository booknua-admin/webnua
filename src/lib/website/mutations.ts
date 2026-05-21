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
import { MAX_NAV_LINKS, type NavLink, type PageSEO, type VersionSnapshot } from './types';

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
      notes: options.force ? `Force publish · ${options.force.reason}` : 'Published from draft.',
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

  const publishedSnapshot = await getPublishedSnapshot(pointers.publishedVersionId);
  const diff: WebsiteApprovalDiff = diffSnapshots(eff.snapshot, publishedSnapshot);

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

async function fetchPendingSubmission(submissionId: string): Promise<SubmissionRow | null> {
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

export async function recallSubmission(submissionId: string): Promise<boolean> {
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

// -- navigation + page names --------------------------------------------------
// Nav links and page titles are snapshot-level fields — not part of the
// content_drafts section buffer — so, like SEO, they write straight to the
// draft version's snapshot. `mergeDraftsIntoSnapshot` preserves `nav` and
// each `page.title` verbatim, so buffered section edits survive these writes.

/** Read the draft version's snapshot, or null when there is none. */
async function getDraftSnapshot(
  websiteId: string,
): Promise<{ draftVersionId: string; snapshot: VersionSnapshot } | null> {
  const pointers = await getWebsitePointers(websiteId);
  if (!pointers?.draftVersionId) return null;
  const { data, error } = await supabase
    .from('website_versions')
    .select('snapshot')
    .eq('id', pointers.draftVersionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    draftVersionId: pointers.draftVersionId,
    snapshot: data.snapshot as VersionSnapshot,
  };
}

/** Persist the website's header navigation (label, order, membership) onto
 *  the draft snapshot. Capped at MAX_NAV_LINKS — extra links are dropped. */
export async function saveNavLinks(
  websiteId: string,
  nav: NavLink[],
): Promise<boolean> {
  const draft = await getDraftSnapshot(websiteId);
  if (!draft) return false;

  const next: VersionSnapshot = {
    ...draft.snapshot,
    nav: nav.slice(0, MAX_NAV_LINKS),
  };

  const { error } = await supabase
    .from('website_versions')
    .update({ snapshot: next as unknown as Json })
    .eq('id', draft.draftVersionId);
  if (error) return false;

  notifyBuilder();
  return true;
}

/** Rename pages on the draft snapshot. Renaming a page also re-syncs the
 *  matching page-target nav link's label, so the header menu tracks the
 *  page name — the operator edits the two together (the "rename a page,
 *  the header updates" behaviour). Blank titles are ignored. */
export async function renamePages(
  websiteId: string,
  titlesByPageId: Record<string, string>,
): Promise<boolean> {
  const draft = await getDraftSnapshot(websiteId);
  if (!draft) return false;

  const trimmed: Record<string, string> = {};
  for (const [id, title] of Object.entries(titlesByPageId)) {
    const t = title.trim();
    if (t) trimmed[id] = t;
  }

  const next: VersionSnapshot = {
    ...draft.snapshot,
    pages: draft.snapshot.pages.map((page) =>
      trimmed[page.id] ? { ...page, title: trimmed[page.id] } : page,
    ),
    nav: draft.snapshot.nav.map((link) => {
      if (link.target.kind !== 'page') return link;
      const title = trimmed[link.target.pageId];
      return title ? { ...link, label: title } : link;
    }),
  };

  const { error } = await supabase
    .from('website_versions')
    .update({ snapshot: next as unknown as Json })
    .eq('id', draft.draftVersionId);
  if (error) return false;

  notifyBuilder();
  return true;
}

// -- custom domain ------------------------------------------------------------
// Connecting a custom domain makes it the website's `domain_primary`; the
// previous primary (the `{slug}.webnua.dev` host) is kept as an alias so the
// old URL still resolves. The `websites` UPDATE RLS is operator-only, so
// these run from an operator session. SSL goes `pending` until Vercel issues
// the cert; the webnua.dev wildcard is always `live`.

/** True when a host is the platform's own wildcard, not a real custom domain. */
function isPlatformHost(host: string): boolean {
  return host.endsWith('.webnua.dev');
}

/** Point the website at a custom domain. Returns false on RLS rejection or a
 *  missing website. */
export async function setCustomDomain(websiteId: string, domain: string): Promise<boolean> {
  const { data: site, error: readError } = await supabase
    .from('websites')
    .select('domain_primary, domain_aliases')
    .eq('id', websiteId)
    .single();
  if (readError || !site) return false;

  const aliases = new Set(site.domain_aliases ?? []);
  // Keep the old primary reachable (unless it was already this domain).
  if (site.domain_primary && site.domain_primary !== domain) {
    aliases.add(site.domain_primary);
  }
  aliases.delete(domain);

  const { error } = await supabase
    .from('websites')
    .update({
      domain_primary: domain,
      domain_aliases: [...aliases],
      domain_ssl_status: 'pending',
    })
    .eq('id', websiteId);
  if (error) return false;

  notifyBuilder();
  return true;
}

/** Disconnect the custom domain — fall back to the `{slug}.webnua.dev` host
 *  (promoted from the aliases). Returns false when there is no platform host
 *  to fall back to. */
export async function clearCustomDomain(websiteId: string): Promise<boolean> {
  const { data: site, error: readError } = await supabase
    .from('websites')
    .select('domain_primary, domain_aliases')
    .eq('id', websiteId)
    .single();
  if (readError || !site) return false;

  const aliases = site.domain_aliases ?? [];
  const fallback = aliases.find(isPlatformHost) ?? aliases[0] ?? site.domain_primary;
  if (!fallback) return false;

  const { error } = await supabase
    .from('websites')
    .update({
      domain_primary: fallback,
      domain_aliases: aliases.filter((a) => a !== fallback),
      domain_ssl_status: isPlatformHost(fallback) ? 'live' : 'pending',
    })
    .eq('id', websiteId);
  if (error) return false;

  notifyBuilder();
  return true;
}
