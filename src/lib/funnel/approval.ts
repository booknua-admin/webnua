// =============================================================================
// Funnel-approval submission shapes (A3 · funnel publish + approval lane).
//
// A sibling of `lib/tickets/website-approval-stub.ts`. The submission state is
// the `funnel_approval_submissions` table (migration 0015 — pre-aligned with
// the website table while the funnel publish lane was deferred) — written by
// `lib/funnel/mutations.ts`, read by the publish-state hooks in
// `lib/funnel/queries.tsx`. This module keeps the display shape the operator
// approvals queue + the editor-lock banner consume, plus the pure step-diff
// helper that produces the approval summary.
//
// The diff shape is reused verbatim from the website lane — "pages" reads as
// "steps" for a funnel; one fewer concept than inventing a parallel type.
// =============================================================================

import type { WebsiteApprovalDiff } from '@/lib/tickets/website-approval-stub';
import type { Section } from '@/lib/website/types';

import type { FunnelStep, FunnelVersionSnapshot } from './types';

export type FunnelApprovalStatus =
  | 'pending'   // waiting on operator action
  | 'approved'  // operator approved + published
  | 'rejected'  // operator rejected (carries reason)
  | 'recalled'; // submitter pulled their own back

/** Reuses the website diff shape — `pagesChanged` reads as steps-changed. */
export type FunnelApprovalDiff = WebsiteApprovalDiff;

export type FunnelApprovalSubmission = {
  id: string;
  funnelId: string;
  /** The funnel_version row that holds this submission's snapshot. */
  pendingVersionId: string;
  /** The user id that hit "Submit for review" — drives the editor lock. */
  submitterId: string;
  submitterName: string;
  /** ISO 8601 timestamp. */
  submittedAt: string;
  status: FunnelApprovalStatus;
  note?: string;
  diff: FunnelApprovalDiff;
  /** Funnel name + client display name — joined for the queue row label. */
  funnelName?: string;
  clientName?: string;
  /** Client slug — used by sub-account filters (the same axis as the
   *  sidebar workspace picker). */
  clientSlug?: string;
  /** Operator's rejection reason (rejected status only). */
  rejectionReason?: string;
  resolvedAt?: string;
  resolvedByName?: string;
};

// ---- Step diff -------------------------------------------------------------
// Mirror of `lib/website/snapshot.ts#diffSnapshots`, walking funnel steps
// instead of website pages (a funnel has no header/footer singletons).

function countSectionFieldsChanged(
  before: Section | undefined,
  after: Section,
): number {
  if (!before) return Object.keys(after.data).length;
  let count = 0;
  const beforeData = before.data ?? {};
  const afterData = after.data ?? {};
  const keys = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
  for (const key of keys) {
    if (JSON.stringify(beforeData[key]) !== JSON.stringify(afterData[key])) {
      count++;
    }
  }
  return count;
}

/** Shallow section-field diff of a funnel draft vs the live published
 *  snapshot — the "X fields in Y sections" approval summary (design §3.4).
 *  `prev` is null for a first-publish funnel; every section then counts. */
export function diffFunnelSnapshots(
  next: FunnelVersionSnapshot,
  prev: FunnelVersionSnapshot | null,
): FunnelApprovalDiff {
  if (!prev) {
    let pagesChanged = 0;
    let sectionsChanged = 0;
    let fieldsChanged = 0;
    for (const step of next.steps) {
      if (step.sections.length === 0) continue;
      pagesChanged++;
      for (const section of step.sections) {
        sectionsChanged++;
        fieldsChanged += Object.keys(section.data).length;
      }
    }
    return { pagesChanged, sectionsChanged, fieldsChanged };
  }

  let pagesChanged = 0;
  let sectionsChanged = 0;
  let fieldsChanged = 0;

  const prevStepById = new Map<string, FunnelStep>(
    prev.steps.map((s) => [s.id, s]),
  );
  for (const step of next.steps) {
    const prevStep = prevStepById.get(step.id);
    let stepTouched = false;
    const prevSectionById = new Map<string, Section>(
      (prevStep?.sections ?? []).map((s) => [s.id, s]),
    );
    for (const section of step.sections) {
      const fieldCount = countSectionFieldsChanged(
        prevSectionById.get(section.id),
        section,
      );
      if (fieldCount > 0) {
        sectionsChanged++;
        fieldsChanged += fieldCount;
        stepTouched = true;
      }
    }
    if (stepTouched) pagesChanged++;
  }

  return { pagesChanged, sectionsChanged, fieldsChanged };
}
