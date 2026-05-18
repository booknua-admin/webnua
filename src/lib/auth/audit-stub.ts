// =============================================================================
// Force-publish audit entry shape (Phase 4).
//
// The audit log itself is now the `force_publish_audit_log` table — entries
// are written by `lib/website/mutations.ts` (publishDraft with `force`) and
// read by `useForcePublishLog` (`lib/website/queries.tsx`). This module keeps
// only the display shape the `ForcePublishLog` component renders.
// =============================================================================

export type ForcePublishEntry = {
  id: string;
  /** ISO 8601 timestamp. */
  at: string;
  /** Who triggered the force-publish. */
  actor: { displayName: string; email: string };
  /** Which client + website the publish affected. */
  target: { clientName: string; websiteId: string; pageTitle: string };
  /** Required free-text reason captured at confirm-time. */
  reason: string;
  /** Version id that became live as a result. */
  newVersionId: string;
};
