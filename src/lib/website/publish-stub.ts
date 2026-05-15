// =============================================================================
// STUB — publish operations + version + approval-submission overlay store.
//
// One module because the operations are tightly coupled: publishDraft and
// submitForApproval both build a snapshot from current draft state, both
// write a new Version, both update reactive state. Splitting would force
// duplicated state-management plumbing.
//
// All mutable state is localStorage-backed via three keys:
//
//   webnua.dev.versions          → record<versionId, Version> (overlay)
//   webnua.dev.website-pointers  → record<websiteId, publishedVersionId>
//   webnua.dev.approvals         → WebsiteApprovalSubmission[]
//
// The version overlay merges with STUB_VERSIONS at read time so existing
// seed data is preserved. Website-pointer overlay updates Website's
// publishedVersionId on publish.
//
// Reactivity: every mutation dispatches APPROVAL_EVENT (shared with
// website-approval-stub). Consumers subscribe via subscribeApprovals.
//
// When real backend ships: this module + the website-approval shapes
// module get replaced by Supabase-backed writes against a `versions`
// table + `approvals` table.
//
// Submit-mid-edit edge case (design doc §3.1):
//   submitForApproval captures the CURRENT SERVER-SIDE DRAFT — which in
//   the stub is whatever has flushed to localStorage. Anything still
//   inside the 500ms autosave debounce window stays in the operator's
//   local React state and is NOT in this snapshot. The operator retains
//   edit access to the resulting pending_approval Version (§3.3 Lane B
//   note), so their next autosave flushes those local edits forward into
//   the same pending snapshot. Nothing is lost; the snapshot moment is
//   server-time, not operator-keystroke-time.
// =============================================================================

import {
  appendForcePublishEntry,
  type ForcePublishEntry,
} from '@/lib/auth/audit-stub';
import { adminClients } from '@/lib/nav/admin-clients';
import {
  APPROVAL_EVENT,
  type WebsiteApprovalDiff,
  type WebsiteApprovalSubmission,
} from '@/lib/tickets/website-approval-stub';

import {
  clearDraftsForWebsite,
  loadDraftSections,
} from './draft-stub';
import {
  findVersion,
  findWebsite,
  getDraftForWebsite,
  getPublishedForWebsite,
  STUB_VERSIONS,
} from './data-stub';
import type {
  NavLink,
  Page,
  Section,
  Version,
  VersionSnapshot,
} from './types';

// ---- Storage keys ---------------------------------------------------------

const VERSIONS_KEY = 'webnua.dev.versions';
const POINTERS_KEY = 'webnua.dev.website-pointers';
const APPROVALS_KEY = 'webnua.dev.approvals';

// ---- Helpers (localStorage IO) -------------------------------------------

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

function readVersionsOverlay(): Record<string, Version> {
  const raw = safeGet(VERSIONS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, Version>;
  } catch {
    return {};
  }
}

function writeVersionsOverlay(next: Record<string, Version>): void {
  safeSet(VERSIONS_KEY, JSON.stringify(next));
}

function readPointersOverlay(): Record<string, string> {
  const raw = safeGet(POINTERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writePointersOverlay(next: Record<string, string>): void {
  safeSet(POINTERS_KEY, JSON.stringify(next));
}

function readApprovals(): WebsiteApprovalSubmission[] {
  const raw = safeGet(APPROVALS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WebsiteApprovalSubmission[];
  } catch {
    return [];
  }
}

function writeApprovals(next: WebsiteApprovalSubmission[]): void {
  safeSet(APPROVALS_KEY, JSON.stringify(next));
}

function notify(): void {
  window.dispatchEvent(new Event(APPROVAL_EVENT));
}

// ---- Public reactive accessors -------------------------------------------

/** Resolve a version by id, preferring overlay then seed. */
export function resolveVersion(id: string): Version | null {
  if (typeof window === 'undefined') return findVersion(id);
  const overlay = readVersionsOverlay();
  return overlay[id] ?? findVersion(id);
}

/** Effective published version for a website, honouring the pointer
 *  overlay. Falls back to the seed pointer when no override exists. */
export function getEffectivePublishedVersionId(
  websiteId: string,
): string | null {
  if (typeof window === 'undefined') {
    return findWebsite(websiteId)?.publishedVersionId ?? null;
  }
  const pointers = readPointersOverlay();
  if (pointers[websiteId]) return pointers[websiteId];
  return findWebsite(websiteId)?.publishedVersionId ?? null;
}

/** Every version known to the system — seed + overlay, overlay wins. */
export function getAllVersions(): Version[] {
  if (typeof window === 'undefined') return [...STUB_VERSIONS];
  const overlay = readVersionsOverlay();
  const merged: Record<string, Version> = {};
  for (const v of STUB_VERSIONS) merged[v.id] = v;
  for (const id in overlay) merged[id] = overlay[id];
  return Object.values(merged);
}

/** All approval submissions, oldest first. */
export function getAllApprovals(): WebsiteApprovalSubmission[] {
  if (typeof window === 'undefined') return [];
  return readApprovals();
}

/** Pending approval submissions for an operator to triage. */
export function getPendingApprovals(): WebsiteApprovalSubmission[] {
  return getAllApprovals().filter((a) => a.status === 'pending');
}

/** Find the live pending submission this user owns for this website,
 *  if any. Used by the editor-lock banner check. */
export function findPendingForUser(
  websiteId: string,
  userId: string,
): WebsiteApprovalSubmission | null {
  return (
    getAllApprovals().find(
      (a) =>
        a.websiteId === websiteId &&
        a.submitterId === userId &&
        a.status === 'pending',
    ) ?? null
  );
}

// ---- Snapshot construction ------------------------------------------------
//
// The single shared draft per website (§3.1). Combines the seed draft
// Version with any localStorage draft slots — slot wins where present.

/** Public accessor for the effective draft snapshot — seed draft Version
 *  merged with any localStorage draft slots. Used by the Session 8 review
 *  surface to run preflight against exactly what would publish. */
export function getEffectiveDraftSnapshot(
  websiteId: string,
): VersionSnapshot | null {
  return buildCurrentSnapshot(websiteId);
}

function buildCurrentSnapshot(websiteId: string): VersionSnapshot | null {
  const draft = getDraftForWebsite(websiteId);
  if (!draft) return null;
  const base = draft.snapshot;

  const mergedPages: Page[] = base.pages.map((page) => {
    const slotSections = loadDraftSections({
      kind: 'page',
      websiteId,
      pageId: page.id,
    });
    if (!slotSections) return page;
    return { ...page, sections: slotSections };
  });

  const headerOverride = loadDraftSections({ kind: 'header', websiteId });
  const footerOverride = loadDraftSections({ kind: 'footer', websiteId });

  const header: Section =
    headerOverride && headerOverride[0] ? headerOverride[0] : base.header;
  const footer: Section =
    footerOverride && footerOverride[0] ? footerOverride[0] : base.footer;

  const nav: NavLink[] = base.nav;
  const pageOrder = base.pageOrder;

  return { pages: mergedPages, header, footer, nav, pageOrder };
}

// ---- Diff -----------------------------------------------------------------
//
// Cheap shallow diff vs the currently-live published snapshot. Counts
// section-level field changes by serializing each section's `data` and
// comparing strings. Good enough for the V1 "X fields changed in Y
// sections" summary; the design doc explicitly defers field-level diff
// view (§3.4).

function countSectionFieldsChanged(
  before: Section | undefined,
  after: Section,
): number {
  if (!before) return Object.keys(after.data).length;
  let count = 0;
  const beforeData = before.data ?? {};
  const afterData = after.data ?? {};
  const keys = new Set([
    ...Object.keys(beforeData),
    ...Object.keys(afterData),
  ]);
  for (const key of keys) {
    if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
      count++;
    }
  }
  return count;
}

function diffSnapshots(
  next: VersionSnapshot,
  prev: VersionSnapshot | null,
): WebsiteApprovalDiff {
  if (!prev) {
    // First publish: count every section + every field.
    let sectionsChanged = 0;
    let fieldsChanged = 0;
    let pagesChanged = 0;
    for (const page of next.pages) {
      if (page.sections.length === 0) continue;
      pagesChanged++;
      for (const section of page.sections) {
        sectionsChanged++;
        fieldsChanged += Object.keys(section.data).length;
      }
    }
    // Header + footer count as their own "page" for the summary.
    if (Object.keys(next.header.data).length > 0) {
      pagesChanged++;
      sectionsChanged++;
      fieldsChanged += Object.keys(next.header.data).length;
    }
    if (Object.keys(next.footer.data).length > 0) {
      pagesChanged++;
      sectionsChanged++;
      fieldsChanged += Object.keys(next.footer.data).length;
    }
    return { pagesChanged, sectionsChanged, fieldsChanged };
  }

  let pagesChanged = 0;
  let sectionsChanged = 0;
  let fieldsChanged = 0;

  const prevPageById = new Map(prev.pages.map((p) => [p.id, p]));
  for (const page of next.pages) {
    const prevPage = prevPageById.get(page.id);
    let pageTouched = false;
    const prevSectionById = new Map(
      (prevPage?.sections ?? []).map((s) => [s.id, s]),
    );
    for (const section of page.sections) {
      const before = prevSectionById.get(section.id);
      const fieldCount = countSectionFieldsChanged(before, section);
      if (fieldCount > 0) {
        sectionsChanged++;
        fieldsChanged += fieldCount;
        pageTouched = true;
      }
    }
    if (pageTouched) pagesChanged++;
  }

  // Header + footer treated as their own "page" buckets for the summary.
  const headerFields = countSectionFieldsChanged(prev.header, next.header);
  if (headerFields > 0) {
    pagesChanged++;
    sectionsChanged++;
    fieldsChanged += headerFields;
  }
  const footerFields = countSectionFieldsChanged(prev.footer, next.footer);
  if (footerFields > 0) {
    pagesChanged++;
    sectionsChanged++;
    fieldsChanged += footerFields;
  }

  return { pagesChanged, sectionsChanged, fieldsChanged };
}

// ---- Operations ----------------------------------------------------------

export type PublishActor = {
  id: string;
  displayName: string;
  /** Required for force-publish audit entries; optional for normal publish. */
  email?: string;
};

export type PublishOptions = {
  /** When set, this is a break-glass force-publish — writes an audit entry
   *  in addition to the normal publish. Chunk F wires this. */
  force?: { reason: string };
};

export type PublishResult = {
  newVersionId: string;
};

/**
 * Lane A publish (or break-glass force-publish when `options.force` is set).
 * Promotes the current draft state into a new published Version, archives
 * the prior published version, updates the website's pointer, and clears
 * the draft store for this website.
 *
 * Returns the new version id (used by callers to write force-publish
 * audit entries — chunk F).
 */
export function publishDraft(
  websiteId: string,
  actor: PublishActor,
  options: PublishOptions = {},
): PublishResult | null {
  const snapshot = buildCurrentSnapshot(websiteId);
  if (!snapshot) return null;

  const versions = readVersionsOverlay();

  const now = new Date().toISOString();
  const newVersionId = `v-${websiteId}-${Date.now()}`;

  const newPublished: Version = {
    id: newVersionId,
    websiteId,
    status: 'published',
    snapshot,
    createdBy: actor.id,
    createdAt: now,
    publishedAt: now,
    publishedBy: actor.id,
    notes: options.force
      ? `Force publish · ${options.force.reason}`
      : 'Published from draft.',
    parentVersionId:
      getEffectivePublishedVersionId(websiteId) ?? undefined,
  };

  versions[newVersionId] = newPublished;

  // Archive the prior published version (if any).
  const prior = getEffectivePublishedVersionId(websiteId);
  if (prior) {
    const priorVersion = resolveVersion(prior);
    if (priorVersion && priorVersion.status === 'published') {
      versions[prior] = { ...priorVersion, status: 'archived' };
    }
  }

  // If a pending approval was sitting on this website, it's now stale —
  // publishing bypasses or fulfils it. Mark as approved.
  const approvals = readApprovals();
  const updatedApprovals = approvals.map((a) => {
    if (a.websiteId === websiteId && a.status === 'pending') {
      return {
        ...a,
        status: 'approved' as const,
        resolvedAt: now,
        resolvedByName: actor.displayName,
      };
    }
    return a;
  });
  writeApprovals(updatedApprovals);

  writeVersionsOverlay(versions);

  // Update the website pointer.
  const pointers = readPointersOverlay();
  pointers[websiteId] = newVersionId;
  writePointersOverlay(pointers);

  // Wipe draft slots — the new published version IS the new baseline.
  clearDraftsForWebsite(websiteId);

  // Force-publish audit entry (design doc §2.4). Every break-glass publish
  // gets a row with actor, target, reason, and the resulting version id.
  if (options.force) {
    const website = findWebsite(websiteId);
    const clientName = website
      ? adminClients.find((c) => c.id === website.clientId)?.name ?? website.name
      : websiteId;
    // The target page is the most-changed page in the snapshot; cheap
    // approximation for a stub. In real backend this would be the page
    // the operator was on when they triggered force-publish.
    const firstPage = snapshot.pages[0]?.title ?? 'Website-level change';
    const entry: ForcePublishEntry = {
      id: `fp-${Date.now()}`,
      at: now,
      actor: {
        displayName: actor.displayName,
        email: actor.email ?? `${actor.id}@webnua.com`,
      },
      target: { clientName, websiteId, pageTitle: firstPage },
      reason: options.force.reason,
      newVersionId,
    };
    appendForcePublishEntry(entry);
  }

  notify();
  return { newVersionId };
}

/**
 * Lane B submit-for-review (design doc §3.3). Creates a `pending_approval`
 * Version + a WebsiteApprovalSubmission record. Does NOT clear the draft
 * store — submitter retains the draft so a Recall or operator-Reject puts
 * them back in business.
 *
 * Submit-mid-edit edge case (§3.1) — see the file-level note above.
 */
export function submitForApproval(
  websiteId: string,
  submitter: { id: string; displayName: string },
  note?: string,
): WebsiteApprovalSubmission | null {
  const snapshot = buildCurrentSnapshot(websiteId);
  if (!snapshot) return null;

  const now = new Date().toISOString();
  const pendingVersionId = `pending-${websiteId}-${Date.now()}`;
  const submissionId = `sub-${websiteId}-${Date.now()}`;

  const pendingVersion: Version = {
    id: pendingVersionId,
    websiteId,
    status: 'pending_approval',
    snapshot,
    createdBy: submitter.id,
    createdAt: now,
    notes: note,
    parentVersionId:
      getEffectivePublishedVersionId(websiteId) ?? undefined,
  };

  const versions = readVersionsOverlay();
  versions[pendingVersionId] = pendingVersion;
  writeVersionsOverlay(versions);

  // Compute the diff for the approval row summary.
  const publishedId = getEffectivePublishedVersionId(websiteId);
  const publishedSnapshot = publishedId
    ? resolveVersion(publishedId)?.snapshot ?? null
    : getPublishedForWebsite(websiteId)?.snapshot ?? null;
  const diff = diffSnapshots(snapshot, publishedSnapshot);

  const submission: WebsiteApprovalSubmission = {
    id: submissionId,
    websiteId,
    pendingVersionId,
    submitterId: submitter.id,
    submitterName: submitter.displayName,
    submittedAt: now,
    status: 'pending',
    note,
    diff,
    snapshot,
  };

  const approvals = readApprovals();
  approvals.push(submission);
  writeApprovals(approvals);

  notify();
  return submission;
}

/**
 * Approve a pending submission and publish it. Promotes the pending
 * version to `published`, archives the prior, updates pointer, and clears
 * draft slots.
 */
export function approveSubmission(
  submissionId: string,
  approver: PublishActor,
): PublishResult | null {
  const approvals = readApprovals();
  const submission = approvals.find((a) => a.id === submissionId);
  if (!submission || submission.status !== 'pending') return null;

  const versions = readVersionsOverlay();
  const pending = versions[submission.pendingVersionId];
  if (!pending) return null;

  const now = new Date().toISOString();
  versions[submission.pendingVersionId] = {
    ...pending,
    status: 'published',
    publishedAt: now,
    publishedBy: approver.id,
  };

  // Archive prior.
  const prior = getEffectivePublishedVersionId(submission.websiteId);
  if (prior && prior !== submission.pendingVersionId) {
    const priorVersion = resolveVersion(prior);
    if (priorVersion && priorVersion.status === 'published') {
      versions[prior] = { ...priorVersion, status: 'archived' };
    }
  }
  writeVersionsOverlay(versions);

  // Update pointer.
  const pointers = readPointersOverlay();
  pointers[submission.websiteId] = submission.pendingVersionId;
  writePointersOverlay(pointers);

  // Mark submission resolved.
  const updated = approvals.map((a) =>
    a.id === submissionId
      ? {
          ...a,
          status: 'approved' as const,
          resolvedAt: now,
          resolvedByName: approver.displayName,
        }
      : a,
  );
  writeApprovals(updated);

  // Clear draft slots — new baseline.
  clearDraftsForWebsite(submission.websiteId);

  notify();
  return { newVersionId: submission.pendingVersionId };
}

/**
 * Operator rejects a pending submission with a free-text reason. The
 * pending Version is archived; the submitter's draft remains intact so
 * they can address the reason and resubmit.
 */
export function rejectSubmission(
  submissionId: string,
  approver: PublishActor,
  reason: string,
): WebsiteApprovalSubmission | null {
  const approvals = readApprovals();
  const submission = approvals.find((a) => a.id === submissionId);
  if (!submission || submission.status !== 'pending') return null;

  const versions = readVersionsOverlay();
  const pending = versions[submission.pendingVersionId];
  if (pending) {
    versions[submission.pendingVersionId] = {
      ...pending,
      status: 'archived',
    };
    writeVersionsOverlay(versions);
  }

  const now = new Date().toISOString();
  const updated = approvals.map((a) =>
    a.id === submissionId
      ? {
          ...a,
          status: 'rejected' as const,
          resolvedAt: now,
          resolvedByName: approver.displayName,
          rejectionReason: reason,
        }
      : a,
  );
  writeApprovals(updated);
  const next = updated.find((a) => a.id === submissionId) ?? null;

  notify();
  return next;
}

/**
 * Submitter recalls their own pending submission. Same end-state as a
 * rejection (pending archived, draft intact) but no reason recorded.
 */
export function recallSubmission(submissionId: string): WebsiteApprovalSubmission | null {
  const approvals = readApprovals();
  const submission = approvals.find((a) => a.id === submissionId);
  if (!submission || submission.status !== 'pending') return null;

  const versions = readVersionsOverlay();
  const pending = versions[submission.pendingVersionId];
  if (pending) {
    versions[submission.pendingVersionId] = {
      ...pending,
      status: 'archived',
    };
    writeVersionsOverlay(versions);
  }

  const now = new Date().toISOString();
  const updated = approvals.map((a) =>
    a.id === submissionId
      ? {
          ...a,
          status: 'recalled' as const,
          resolvedAt: now,
        }
      : a,
  );
  writeApprovals(updated);
  const next = updated.find((a) => a.id === submissionId) ?? null;

  notify();
  return next;
}

/**
 * Restore a prior version's snapshot as the current draft. Session 8
 * (design doc §7). Does NOT auto-publish — the restored draft enters the
 * normal lanes; the operator must publish or submit-for-review through
 * the editor + review surface like any other change. Pending submissions
 * on this website block the restore (the submitter's pending content
 * would be silently overwritten otherwise).
 */
export function restoreVersionAsDraft(
  websiteId: string,
  sourceVersionId: string,
  actor: PublishActor,
): { newDraftId: string } | null {
  const source = resolveVersion(sourceVersionId);
  if (!source || source.websiteId !== websiteId) return null;

  // Refuse while a pending submission is in flight — restore would
  // silently overwrite the submitter's diff.
  const approvals = readApprovals();
  const hasPending = approvals.some(
    (a) => a.websiteId === websiteId && a.status === 'pending',
  );
  if (hasPending) return null;

  const versions = readVersionsOverlay();
  const now = new Date().toISOString();
  const newDraftId = `v-${websiteId}-restore-${Date.now()}`;

  // Archive any existing draft (overlay or seed) so the new restored
  // draft is the sole draft for this website. Mirrors publishDraft's
  // pattern of archiving prior versions of the same status.
  const allVersions = getAllVersions().filter((v) => v.websiteId === websiteId);
  for (const v of allVersions) {
    if (v.status === 'draft') {
      versions[v.id] = { ...v, status: 'archived' };
    }
  }

  const restored: Version = {
    id: newDraftId,
    websiteId,
    status: 'draft',
    // Deep-copy the snapshot so future edits to the restored draft don't
    // mutate the source version's snapshot.
    snapshot: JSON.parse(JSON.stringify(source.snapshot)) as VersionSnapshot,
    createdBy: actor.id,
    createdAt: now,
    parentVersionId: source.id,
    notes: `Restored from ${source.status} version ${source.id}`,
  };

  versions[newDraftId] = restored;
  writeVersionsOverlay(versions);

  // Wipe local draft slots so the editor rehydrates from the restored
  // snapshot rather than stale per-section overrides.
  clearDraftsForWebsite(websiteId);

  notify();
  return { newDraftId };
}
