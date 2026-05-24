// =============================================================================
// Website-approval submission shapes (Phase 4).
//
// The submission state is now the `website_approval_submissions` table —
// written by `lib/website/mutations.ts`, read by the publish-state hooks in
// `lib/website/queries.tsx`. This module keeps only the display shapes the
// "Website approvals" tab and the Lane B editor-lock banner consume.
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
  /** Client display name — joined for the approval row's avatar/label. */
  clientName?: string;
  /** Client slug — used by sub-account filters (the same axis as the
   *  sidebar workspace picker). */
  clientSlug?: string;
  /** Full snapshot at submit-time. The pending version holds the canonical
   *  copy (§5 #10 — no duplicated blob); left undefined by the live reads. */
  snapshot?: VersionSnapshot;
  /** Operator's rejection reason (rejected status only). */
  rejectionReason?: string;
  /** When approved / rejected / recalled. */
  resolvedAt?: string;
  resolvedByName?: string;
};
