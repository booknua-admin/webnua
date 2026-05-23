// =============================================================================
// GBP integration job types + payload shapes.
//
// Two registered handlers (see job-handlers.ts):
//
// 1. gbp_sync_reviews — pulls recent reviews from Google's listReviews and
//    upserts gbp_reviews rows. Enqueued by:
//      • The daily pg_cron schedule (migration 0069) — one job per
//        connected client.
//      • The operator "Sync now" route — on demand.
//
// 2. gbp_send_review_request — sends a review-request SMS or email to a
//    customer. Enqueued by:
//      • The booking-completion trigger (migration 0069) with a 2-hour
//        delay.
//      • The operator manual-send route — immediate (no delay).
//
// The payloads are exported here so the producer side (the route handlers,
// the trigger SQL) and the consumer side (the registered handler) share one
// type. The trigger's `jsonb_build_object` already produces this shape.
//
// SERVER + CLIENT safe — pure types + constants.
// =============================================================================

export const GBP_SYNC_REVIEWS_JOB = 'gbp_sync_reviews';

export type GbpSyncReviewsPayload = {
  clientId: string;
  /** When true, the sync also re-fetches the location detail (rating count,
   *  metadata.placeId / newReviewUri) — used on first connect + after the
   *  operator explicitly hits "Sync now". The daily cron leaves this off
   *  (false / undefined) to keep the per-day API cost low. */
  refreshLocation?: boolean;
};

export const GBP_SEND_REVIEW_REQUEST_JOB = 'gbp_send_review_request';

export type GbpSendReviewRequestPayload = {
  clientId: string;
  /** The booking that triggered the request (null = manual operator send
   *  with no booking context). */
  bookingId: string | null;
  /** Optional linked lead — populated when the booking carries a lead_id. */
  leadId: string | null;
  /** Optional linked customer — populated by the trigger via the booking's
   *  customer_id. The job handler uses this to refresh contact info, falling
   *  back to the recipientPhone / recipientEmail payload fields. */
  customerId: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
};

/** Type-narrow a raw payload from `integration_jobs.payload` into a
 *  GbpSendReviewRequestPayload. The trigger SQL produces nullable strings
 *  for the recipient/customer/lead fields ("null"-string vs JSON null
 *  isn't safe to assume — sanitise here). */
export function normalizeSendReviewRequestPayload(
  raw: unknown,
): GbpSendReviewRequestPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const clientId = stringOrNull(r.clientId);
  if (!clientId) return null;
  return {
    clientId,
    bookingId: stringOrNull(r.bookingId),
    leadId: stringOrNull(r.leadId),
    customerId: stringOrNull(r.customerId),
    recipientName: stringOrNull(r.recipientName),
    recipientPhone: stringOrNull(r.recipientPhone),
    recipientEmail: stringOrNull(r.recipientEmail),
  };
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  // Postgres' jsonb_build_object emits SQL NULL as JSON null on cast, but
  // legacy callers may pass the string 'null' or '' — coalesce both.
  if (trimmed.length === 0 || trimmed === 'null') return null;
  return trimmed;
}
