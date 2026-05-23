'use client';

// =============================================================================
// ReviewItem — single review row on `/reviews` (full variant) + per-client
// card on operator `/reviews` (compact variant).
//
// Phase 7 GBP consolidation: the row carries optional reply state from
// `gbp_reviews` AND a per-row inline reply composer (gated on the parent
// passing `clientId` via the review data — without it, the reply
// affordance is hidden, which is how non-GBP / read-only callers opt out).
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useReplyToGbpReview } from '@/lib/integrations/gbp/use-gbp';
import type { ReviewItem as ReviewItemData } from '@/lib/reviews/types';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

type ReviewItemProps = {
  review: ReviewItemData;
  /** `full` = client `/reviews` row (avatar + name+job + quote + stars + age).
   *  `compact` = admin per-client card recent-review row (strong-name + quote
   *  + right-aligned stars + age). */
  variant: 'full' | 'compact';
  className?: string;
};

function ReviewItem({ review, variant, className }: ReviewItemProps) {
  if (variant === 'full') {
    return (
      <div
        data-slot="review-item"
        data-variant="full"
        className={cn(
          'grid grid-cols-[44px_1fr_100px_80px] items-start gap-4 border-b border-paper-2 px-5.5 py-4.5 last:border-b-0',
          className,
        )}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-2 text-[14px] font-bold text-ink">
          {review.authorInitials ?? review.authorName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-[14px] font-bold text-ink">
              {review.authorName}
            </span>
            {review.job ? (
              <span className="text-[12px] text-ink-quiet">· {review.job}</span>
            ) : null}
          </div>
          <p className="text-[13px] leading-[1.5] text-ink-soft">
            {review.text}
          </p>
          <ReviewReplyBlock review={review} variant="full" />
        </div>
        <div className="text-left text-[14px] font-bold leading-[1.6] text-rust">
          {'★'.repeat(review.stars)}
        </div>
        <div className="text-right font-mono text-[10px] leading-[1.6] tracking-[0.04em] text-ink-quiet">
          {review.age}
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="review-item"
      data-variant="compact"
      className={cn(
        'grid grid-cols-[1fr_auto] items-start gap-2.5 border-b border-dotted border-rule py-2 last:border-b-0',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="line-clamp-2 text-[12px] leading-[1.4] text-ink-soft [&_strong]:font-bold [&_strong]:text-ink">
          <strong>{review.authorName}</strong> · &ldquo;{review.text}&rdquo;
        </p>
        <ReviewReplyBlock review={review} variant="compact" />
      </div>
      <div className="text-right text-[12px] font-bold text-rust">
        {'★'.repeat(review.stars)} · {review.age}
      </div>
    </div>
  );
}

// --- inline reply block ------------------------------------------------------

/** Renders the existing reply (when present) OR an inline reply composer
 *  (when the caller passed `clientId` so a reply mutation can dispatch).
 *  Hides entirely on a row with neither — read-only fallback for any
 *  non-GBP caller. */
function ReviewReplyBlock({
  review,
  variant,
}: {
  review: ReviewItemData;
  variant: 'full' | 'compact';
}) {
  if (review.reply) {
    return (
      <div
        className={cn(
          'mt-2 rounded-md bg-paper-2 px-3 py-2',
          variant === 'compact' && 'mt-1.5 px-2.5 py-1.5',
        )}
      >
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
          Your reply · {relativeTime(review.reply.at)}
        </div>
        <p
          className={cn(
            'text-[13px] leading-[1.5] text-ink',
            variant === 'compact' && 'text-[12px] leading-[1.4]',
          )}
        >
          {review.reply.text}
        </p>
      </div>
    );
  }
  if (!review.clientId) return null;
  return <InlineReplyComposer review={review} variant={variant} />;
}

function InlineReplyComposer({
  review,
  variant,
}: {
  review: ReviewItemData;
  variant: 'full' | 'compact';
}) {
  const reply = useReplyToGbpReview(review.clientId ?? null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  async function submit() {
    const text = draft.trim();
    if (text.length === 0) return;
    try {
      await reply.mutateAsync({ reviewId: review.id, replyText: text });
      setOpen(false);
      setDraft('');
    } catch {
      /* error surfaced via reply.error */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust transition-colors hover:text-rust-deep',
          variant === 'compact' && 'mt-1.5 text-[9px]',
        )}
      >
        Reply →
      </button>
    );
  }

  return (
    <div
      className={cn(
        'mt-2 rounded-md bg-paper-2 px-3 py-2',
        variant === 'compact' && 'mt-1.5 px-2.5 py-1.5',
      )}
    >
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a reply… keep it human."
        rows={variant === 'compact' ? 2 : 3}
        className="bg-card text-[13px]"
      />
      {reply.error ? (
        <div className="mt-1.5 text-[11px] text-warn">
          {(reply.error as Error).message}
        </div>
      ) : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            setDraft('');
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={draft.trim().length === 0 || reply.isPending}
          onClick={submit}
        >
          {reply.isPending ? 'Sending…' : 'Reply'}
        </Button>
      </div>
    </div>
  );
}

export { ReviewItem };
export type { ReviewItemProps };
