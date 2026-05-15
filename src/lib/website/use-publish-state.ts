'use client';

// =============================================================================
// useWebsitePublishState — reactive accessor over publish-stub for a single
// website. Every editor mount + every approval-queue row subscribes via this
// hook so localStorage mutations propagate instantly without page reloads.
// =============================================================================

import { useSyncExternalStore } from 'react';

import {
  type WebsiteApprovalSubmission,
  subscribeApprovals,
} from '@/lib/tickets/website-approval-stub';

import {
  findPendingForUser,
  getPendingApprovals,
  getWebsitePublishSnapshot,
} from './publish-stub';

export type WebsitePublishState = {
  publishedVersionId: string | null;
  /** All approval submissions for this website, in time order. */
  approvalsForWebsite: WebsiteApprovalSubmission[];
  /** The currently-pending submission on this website (if any). */
  livePendingSubmission: WebsiteApprovalSubmission | null;
};

const SERVER_STATE: WebsitePublishState = {
  publishedVersionId: null,
  approvalsForWebsite: [],
  livePendingSubmission: null,
};

export function useWebsitePublishState(websiteId: string): WebsitePublishState {
  return useSyncExternalStore(
    subscribeApprovals,
    () => getWebsitePublishSnapshot(websiteId),
    () => SERVER_STATE,
  );
}

/** Returns the pending submission this user owns on this website, if any.
 *  `websiteId === null` short-circuits to null — used by the funnel-step
 *  editor, which has no Lane B yet (Session 7 funnel mode). */
export function useUserPendingSubmission(
  websiteId: string | null,
  userId: string | null,
): WebsiteApprovalSubmission | null {
  return useSyncExternalStore(
    subscribeApprovals,
    () =>
      websiteId && userId ? findPendingForUser(websiteId, userId) : null,
    () => null,
  );
}

/** Pending approvals across the entire workspace (used by /tickets). */
export function useAllPendingApprovals(): WebsiteApprovalSubmission[] {
  return useSyncExternalStore(
    subscribeApprovals,
    () => getPendingApprovals(),
    () => [],
  );
}
