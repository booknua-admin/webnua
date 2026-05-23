// =============================================================================
// gbp_reviews data access.
//
// Service-role reads + writes against gbp_reviews (migration 0067). Called
// by:
//   • The gbp_sync_reviews job — upserts what GBP returned, marks any row
//     no longer present as deleted_at_google.
//   • The operator reply route — once Google accepts a reply we cache it
//     locally so the inbox shows the operator's own reply without waiting
//     for the next daily sync.
//   • The dashboard "Mark reviews seen" call — flips
//     is_new_since_last_view to false on the operator's read.
//   • The send-request → resulted_in_review_id attribution path (the
//     attribution helper here finds an unmatched request the new review
//     could have arrived from).
//
// SERVER-ONLY.
// =============================================================================

import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type { GbpReviewInsert, GbpReviewRow } from './types';

/** Build the set of gbp_review_ids the platform currently knows about for
 *  one client. Used by the sync job to decide which reviews returned by
 *  Google are genuinely new (worth flagging as `is_new_since_last_view`)
 *  vs already-seen (preserve their prior seen state). */
export async function listKnownReviewIds(clientId: string): Promise<Set<string>> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('gbp_reviews')
    .select('gbp_review_id')
    .eq('client_id', clientId);
  if (error) {
    throw new Error(`listKnownReviewIds failed: ${error.message}`);
  }
  const rows = (data as { gbp_review_id: string }[] | null) ?? [];
  return new Set(rows.map((row) => row.gbp_review_id));
}

/** Upsert a batch of reviews for one client. The (client_id,
 *  gbp_review_id) unique constraint makes this a fan-update — repeated
 *  identical rows are a no-op, edits to comment/rating land in place. */
export async function upsertReviews(
  reviews: GbpReviewInsert[],
): Promise<GbpReviewRow[]> {
  if (reviews.length === 0) return [];
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('gbp_reviews')
    .upsert(reviews, { onConflict: 'client_id,gbp_review_id' })
    .select('*');
  if (error) {
    throw new Error(`upsertReviews failed: ${error.message}`);
  }
  return (data as GbpReviewRow[]) ?? [];
}

/** Mark every review for one client whose gbp_review_id is NOT in
 *  `presentReviewIds` as deleted_at_google. Run after a full sync —
 *  reviews removed at Google should drop out of the visible list but
 *  stay for audit. */
export async function markReviewsDeleted(
  clientId: string,
  presentReviewIds: string[],
): Promise<void> {
  const db = getIntegrationDb();
  // Build the NOT-IN list defensively — an empty array makes Postgres
  // delete every undeleted row (the empty IN is FALSE), which IS what we
  // want if the sync genuinely returned zero reviews. Guard explicitly so
  // the intent is obvious.
  let query = db
    .from('gbp_reviews')
    .update({ deleted_at_google: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('deleted_at_google', null);
  if (presentReviewIds.length > 0) {
    query = query.not(
      'gbp_review_id',
      'in',
      `(${presentReviewIds.map((id) => `"${id.replace(/"/g, '""')}"`).join(',')})`,
    );
  }
  const { error } = await query;
  if (error) {
    throw new Error(`markReviewsDeleted failed: ${error.message}`);
  }
}

/** Mark every unseen review for a client as seen. The dashboard widget
 *  fires this when an operator opens the reviews list. */
export async function markReviewsSeen(clientId: string): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from('gbp_reviews')
    .update({ is_new_since_last_view: false })
    .eq('client_id', clientId)
    .eq('is_new_since_last_view', true);
  if (error) {
    throw new Error(`markReviewsSeen failed: ${error.message}`);
  }
}

/** Persist a fresh reply on a review. Called by the operator-reply route
 *  after the GBP API accepted the reply — pre-image of the next daily
 *  sync, just so the inbox refresh shows the reply without waiting. */
export async function recordReviewReply(
  reviewId: string,
  replyText: string,
  replyCreatedAt: string,
): Promise<void> {
  const db = getIntegrationDb();
  const { error } = await db
    .from('gbp_reviews')
    .update({
      reply_text: replyText,
      reply_created_at: replyCreatedAt,
    })
    .eq('id', reviewId);
  if (error) {
    throw new Error(`recordReviewReply failed: ${error.message}`);
  }
}

/** Fetch one review row by its DB id — used by the reply route to load
 *  the gbp_review_id (the API path) when the operator clicks reply. */
export async function findReviewById(
  reviewId: string,
): Promise<GbpReviewRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('gbp_reviews')
    .select('*')
    .eq('id', reviewId)
    .maybeSingle();
  if (error) {
    throw new Error(`findReviewById failed: ${error.message}`);
  }
  return (data as GbpReviewRow | null) ?? null;
}
