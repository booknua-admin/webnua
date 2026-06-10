// =============================================================================
// Conversation intelligence — AI-drafted review replies (SERVER-ONLY).
//
// `draft_review_reply` is enqueued by the GBP sync for every fresh review
// without a published reply. The handler drafts a short personalised reply
// in the owner's voice and lands it as a `review_reply_draft` suggested
// action — the owner approves (which posts the reply to Google via the
// existing GBP reply route), edits, or dismisses. Replies are NEVER posted
// automatically — auto-publishing AI replies on customer reviews is the
// credibility footgun the platform's parked decision explicitly names.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

import { createSuggestedAction } from '@/lib/actions/server';
import { env } from '@/lib/env';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { registerJobHandler } from '@/lib/integrations/_shared/jobs';

const MODEL = 'claude-haiku-4-5-20251001';

export const DRAFT_REVIEW_REPLY_JOB = 'draft_review_reply';

const SYSTEM_PROMPT = `You draft a Google-review reply for a local service business owner. Rules:
- First person, as the owner. Warm, plain English. Under 60 words.
- Thank them by first name when you have it. Reference ONE specific detail from the review so it reads personal, never templated.
- 4-5 stars: gratitude + a "see you next time" note. Never ask for anything.
- 3 stars or below: apologise plainly, take ownership, invite them to call so you can make it right. Never defensive, never excuses, never argue facts.
- NEVER invent details (job specifics, discounts, promises) not in the review.
Output the reply text only — no JSON, no quotes around it.`;

type ReviewRow = {
  id: string;
  client_id: string;
  reviewer_name: string | null;
  rating: number;
  comment: string | null;
  reply_text: string | null;
};

registerJobHandler(DRAFT_REVIEW_REPLY_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as { reviewDbId?: unknown; clientId?: unknown };
  const reviewDbId = typeof payload.reviewDbId === 'string' ? payload.reviewDbId : null;
  const clientId = typeof payload.clientId === 'string' ? payload.clientId : null;
  if (!reviewDbId || !clientId) {
    throw new Error('draft_review_reply: missing reviewDbId / clientId');
  }
  if (!env.ANTHROPIC_API_KEY) return { skipped: 'anthropic-not-configured' };

  const db = getIntegrationDb();
  const [{ data: reviewData }, { data: clientData }] = await Promise.all([
    db
      .from('gbp_reviews')
      .select('id, client_id, reviewer_name, rating, comment, reply_text')
      .eq('id', reviewDbId)
      .maybeSingle(),
    db.from('clients').select('name').eq('id', clientId).maybeSingle(),
  ]);
  const review = reviewData as ReviewRow | null;
  const businessName = (clientData as { name: string } | null)?.name ?? 'the business';
  if (!review || review.client_id !== clientId) return { skipped: 'review-not-found' };
  if (review.reply_text) return { skipped: 'already-replied' };

  const reviewerName = review.reviewer_name ?? 'the customer';
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          `Business: ${businessName}`,
          `Reviewer: ${reviewerName}`,
          `Rating: ${review.rating} out of 5 stars`,
          `Review: ${review.comment?.slice(0, 1500) || '(no written comment — star rating only)'}`,
        ].join('\n'),
      },
    ],
  });
  const draft = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  if (!draft) return { skipped: 'empty-draft' };

  const stars = '★'.repeat(review.rating);
  const actionId = await createSuggestedAction({
    clientId,
    kind: 'review_reply_draft',
    title:
      review.rating <= 3
        ? `${review.rating}★ review from ${reviewerName} — reply drafted`
        : `Reply drafted for ${reviewerName}'s ${stars} review`,
    body: draft,
    explanation:
      review.rating <= 3
        ? `Detected: ${review.rating}-star review — needs a careful reply`
        : `New ${review.rating}-star Google review`,
    payload: { reviewDbId: review.id, draftText: draft, rating: review.rating },
    sourceEntityType: 'gbp_review',
    sourceEntityId: review.id,
    dedupeKey: `review_reply:${review.id}`,
    urgency: review.rating <= 2 ? 'high' : 'normal',
    expiresInHours: 24 * 14,
  });
  return { actionId, rating: review.rating };
});
