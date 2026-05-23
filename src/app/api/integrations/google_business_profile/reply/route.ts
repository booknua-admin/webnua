// =============================================================================
// /api/integrations/google_business_profile/reply
//
// Operator-only — replies to a GBP review through the Webnua UI. Reply text
// is sent to Google's v4 reply endpoint via callWithToken, then cached on
// the gbp_reviews row so the inbox refresh shows the reply immediately
// (the next daily sync would otherwise be the source of truth).
//
//   POST { clientId, reviewId, replyText }
//     reviewId is the gbp_reviews.id (DB primary key — the UI passes it).
//     replyText must be 1..4096 chars (Google's limit is ~4096 — we cap).
//
// Auto-generated replies aren't built — every reply is a human one for V1.
// =============================================================================

import { NextResponse } from 'next/server';

import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { isGbpConfigured, replyToReview } from '@/lib/integrations/gbp/client';
import { findReviewById, recordReviewReply } from '@/lib/integrations/gbp/reviews';

const MAX_REPLY_LENGTH = 4096;

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown; reviewId?: unknown; replyText?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }
  const reviewId = body.reviewId;
  if (typeof reviewId !== 'string' || reviewId.length === 0) {
    return NextResponse.json({ error: 'missing-reviewId' }, { status: 400 });
  }
  const rawReply = body.replyText;
  if (typeof rawReply !== 'string') {
    return NextResponse.json({ error: 'missing-replyText' }, { status: 400 });
  }
  const replyText = rawReply.trim();
  if (replyText.length === 0) {
    return NextResponse.json({ error: 'empty-replyText' }, { status: 400 });
  }
  if (replyText.length > MAX_REPLY_LENGTH) {
    return NextResponse.json({ error: 'reply-too-long' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isGbpConfigured()) {
    return NextResponse.json({ error: 'gbp-not-configured' }, { status: 503 });
  }

  // Resolve the gbp_review_id (the API path) from the DB row, and guard
  // tenant access — RLS-bound find returns null for a review outside
  // the operator's scope (the access check already ran above, but a
  // missing-row response here is the right shape).
  const review = await findReviewById(reviewId);
  if (!review || review.client_id !== clientId) {
    return NextResponse.json({ error: 'review-not-found' }, { status: 404 });
  }

  const result = await replyToReview(clientId, review.gbp_review_id, replyText);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'reply-failed', detail: result.error.message, errorClass: result.error.class },
      { status: 502 },
    );
  }

  await recordReviewReply(
    reviewId,
    replyText,
    result.data.updateTime ?? new Date().toISOString(),
  );

  return NextResponse.json({ ok: true });
}
