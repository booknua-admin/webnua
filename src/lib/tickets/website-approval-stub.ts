// =============================================================================
// STUB — pending website-approval submissions, the data behind the
// "Website approvals" tab on /tickets and the Lane B editor lock banner.
//
// A submission is created when a user with edit caps but NO `publish` cap
// (Lane B in design doc §3.3) hits "Submit for review →". The pending
// version is captured as a snapshot at submit-time, plus diff counts versus
// the currently-live published version. Operators triage the queue, then
// Approve / Edit-then-publish / Reject.
//
// State lives in `publish-stub.ts` — this module just owns the shapes,
// helpers, and the localStorage subscription glue. Real backend will
// replace both modules together.
// =============================================================================

import type { VersionSnapshot } from '@/lib/website/types';

export type WebsiteApprovalStatus =
  | 'pending'      // waiting on operator action
  | 'approved'     // operator approved + published
  | 'rejected'     // operator rejected (carries reason)
  | 'recalled';    // submitter pulled their own back

export type WebsiteApprovalDiff = {
  /** Number of pages where at least one field changed vs published. */
  pagesChanged: number;
  /** Number of sections where at least one field changed vs published. */
  sectionsChanged: number;
  /** Total fields touched. For first-publish (no published baseline)
   *  this counts every section's fields against an empty baseline. */
  fieldsChanged: number;
};

export type WebsiteApprovalSubmission = {
  id: string;
  websiteId: string;
  /** The version id that holds this submission's snapshot. */
  pendingVersionId: string;
  /** The user id that hit "Submit for review". Used for the lock check. */
  submitterId: string;
  submitterName: string;
  /** ISO 8601 timestamp. */
  submittedAt: string;
  status: WebsiteApprovalStatus;
  /** Optional submitter note attached to the submission. */
  note?: string;
  diff: WebsiteApprovalDiff;
  /** Full snapshot at submit-time. Mirrors the pending_approval Version's
   *  snapshot — duplicated here so the approval row can render without
   *  loading the Version. */
  snapshot: VersionSnapshot;
  /** Operator's rejection reason (rejected status only). */
  rejectionReason?: string;
  /** When approved / rejected / recalled. */
  resolvedAt?: string;
  resolvedByName?: string;
};

// ---- Subscription ---------------------------------------------------------
//
// The event bus is shared with publish-stub via the same module-level
// event name, so any consumer subscribed to publish state automatically
// re-renders when an approval changes — they're two halves of one store.

export const APPROVAL_EVENT = 'webnua:approval-change';

export function subscribeApprovals(callback: () => void): () => void {
  window.addEventListener('storage', callback);
  window.addEventListener(APPROVAL_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(APPROVAL_EVENT, callback);
  };
}
