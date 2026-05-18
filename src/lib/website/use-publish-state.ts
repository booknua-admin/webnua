'use client';

// =============================================================================
// Publish-state hooks — Phase 4 re-export shim.
//
// The reactive publish-state hooks moved into `queries.tsx` (live Supabase
// reads). This module re-exports them so existing consumers
// (`SectionEditor`, `VersionHistoryCard`, the /tickets approvals tab) keep
// their import path unchanged.
// =============================================================================

export {
  useWebsitePublishState,
  useUserPendingSubmission,
  useAllPendingApprovals,
  type WebsitePublishState,
} from './queries';
