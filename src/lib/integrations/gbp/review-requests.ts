// =============================================================================
// gbp_review_requests data access.
//
// Service-role writes against gbp_review_requests (migration 0068). One row
// per review-request send attempt, written by:
//   • The gbp_send_review_request job — at terminal status (sent or failed),
//     with the channel + recipient snapshot frozen at send-time.
//   • The operator manual-send route — same shape, manually-triggered.
//
// The sync job calls `attributeRecentReviewToRequest()` to link a freshly-
// landed review back to the request that asked for it (a review arriving
// within 7 days of a sent request).
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  GbpReviewRequestInsert,
  GbpReviewRequestRow,
} from './types';

/** The window inside which a fresh review is considered "caused by" a
 *  previously-sent request. Practical heuristic — customers who leave a
 *  review more than a week after the prompt almost always wrote it
 *  unprompted, so the link would mislead the conversion-rate dashboard. */
const ATTRIBUTION_WINDOW_DAYS = 7;

/** Insert one review-request row. Used by both the job handler (after a
 *  send attempt) and the operator manual-send route. */
export async function insertReviewRequest(
  insert: GbpReviewRequestInsert,
): Promise<GbpReviewRequestRow> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('gbp_review_requests')
    .insert(insert)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`insertReviewRequest failed: ${error?.message ?? 'no row returned'}`);
  }
  return data as GbpReviewRequestRow;
}

/** Find the most recent un-attributed review-request that could plausibly
 *  have led to the given review. Strategy:
 *   1. Same client.
 *   2. Sent within the attribution window before the review landed.
 *   3. No existing attribution (resulted_in_review_id null).
 *   4. Channel reached the customer (status was sent/delivered, not failed).
 *  Returns null when no candidate exists. */
export async function findAttributableRequest(
  clientId: string,
  reviewCreatedAt: string,
): Promise<GbpReviewRequestRow | null> {
  const db = getIntegrationDb();
  const windowMs = ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.parse(reviewCreatedAt) - windowMs).toISOString();

  const { data, error } = await db
    .from('gbp_review_requests')
    .select('*')
    .eq('client_id', clientId)
    .is('resulted_in_review_id', null)
    .in('status', ['sent', 'delivered'])
    .gte('sent_at', cutoff)
    .lte('sent_at', reviewCreatedAt)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`findAttributableRequest failed: ${error.message}`);
  }
  return (data as GbpReviewRequestRow | null) ?? null;
}

/** Link a request row to the review it produced. The sync job calls this
 *  for each newly-imported review with a matching candidate. */
export async function attributeRequestToReview(
  requestId: string,
  reviewId: string,
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from('gbp_review_requests')
    .update({ resulted_in_review_id: reviewId })
    .eq('id', requestId);
  if (error) {
    throw new Error(`attributeRequestToReview failed: ${error.message}`);
  }
}
