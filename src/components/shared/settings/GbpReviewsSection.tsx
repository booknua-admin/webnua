'use client';

// =============================================================================
// GbpReviewsSection — recent reviews list with inline reply UI.
//
// Lives below GbpLocationSection on /settings/google-business. Each row:
//   • Reviewer name + photo (or "Anonymous") + relative age.
//   • Star row.
//   • Comment.
//   • Existing operator reply (collapsed) or a "Reply" affordance that
//     expands to a Textarea + Send button.
//
// Auto-marks reviews seen on mount — operators see the badge clear the
// moment they open the surface.
// =============================================================================

import { useEffect, useState } from 'react';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { GbpReviewRow } from '@/lib/integrations/gbp/types';
import {
  useClientGbpReviews,
  useMarkGbpReviewsSeen,
  useReplyToGbpReview,
} from '@/lib/integrations/gbp/use-gbp';

const STAR = '★';
const EMPTY_STAR = '☆';

function stars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return STAR.repeat(r) + EMPTY_STAR.repeat(5 - r);
}

function ratingToneClass(rating: number): string {
  if (rating >= 4) return 'text-good';
  if (rating >= 3) return 'text-ink-quiet';
  return 'text-warn';
}

function relativeAge(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function GbpReviewsSection({ clientId }: { clientId: string | null }) {
  const reviews = useClientGbpReviews(clientId);
  const markSeen = useMarkGbpReviewsSeen(clientId);

  // Auto-clear the badge once the list has loaded with at least one
  // unseen review. Fire-and-forget — no toast.
  useEffect(() => {
    const rows = reviews.data ?? [];
    if (rows.some((r) => r.is_new_since_last_view) && clientId && !markSeen.isPending) {
      markSeen.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews.data, clientId]);

  const rows = reviews.data ?? [];

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Recent <em>reviews</em>
          </>
        }
        description={
          <>
            <strong>Pulled from Google daily.</strong> Reply directly from here
            and the response is published to the listing within seconds.
          </>
        }
      >
        {reviews.isLoading ? (
          <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
            Loading reviews…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-6 text-center text-[13px] text-ink-quiet">
            No reviews to display yet. Once Google reviews land on the
            connected location, the daily sync will surface them here.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((review) => (
              <ReviewRow key={review.id} review={review} clientId={clientId} />
            ))}
          </div>
        )}
      </SettingsSection>
    </SettingsPanel>
  );
}

function ReviewRow({
  review,
  clientId,
}: {
  review: GbpReviewRow;
  clientId: string | null;
}) {
  const reply = useReplyToGbpReview(clientId);
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

  return (
    <div className="rounded-[10px] border border-rule bg-card px-5 py-4">
      <div className="mb-2 flex items-start gap-3">
        <Avatar
          name={review.reviewer_name ?? 'Anonymous'}
          photoUrl={review.reviewer_profile_photo_url}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-ink">
              {review.reviewer_name ?? 'Anonymous'}
            </span>
            {review.is_new_since_last_view ? (
              <span className="rounded-full bg-rust/12 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-rust">
                New
              </span>
            ) : null}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
            {relativeAge(review.created_at_google)}
            {review.updated_at_google &&
            review.updated_at_google !== review.created_at_google
              ? ' · edited'
              : ''}
          </div>
        </div>
        <div className={`font-mono text-[16px] tracking-[0.06em] ${ratingToneClass(review.rating)}`}>
          {stars(review.rating)}
        </div>
      </div>

      {review.comment ? (
        <p className="mb-3 text-[13px] leading-[1.55] text-ink">{review.comment}</p>
      ) : (
        <p className="mb-3 text-[12px] italic text-ink-quiet">
          (No comment — star rating only.)
        </p>
      )}

      {review.reply_text ? (
        <div className="rounded-md bg-paper-2 px-3.5 py-2.5">
          <div className="mb-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
            Your reply
            {review.reply_created_at
              ? ` · ${relativeAge(review.reply_created_at)}`
              : ''}
          </div>
          <p className="text-[13px] leading-[1.55] text-ink">{review.reply_text}</p>
        </div>
      ) : open ? (
        <div className="rounded-md bg-paper-2 px-3.5 py-2.5">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply… keep it human."
            rows={3}
            className="bg-card"
          />
          {reply.error ? (
            <div className="mt-2 text-[11px] text-warn">{(reply.error as Error).message}</div>
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
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Reply
          </Button>
        </div>
      )}
    </div>
  );
}

function Avatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl: string | null;
}) {
  if (photoUrl) {
    // Defensive: Google profile photo URLs are user-controlled — use
    // referrerPolicy + loading lazy. Wrap in a sized container.
    return (
      <div className="size-9 shrink-0 overflow-hidden rounded-full bg-paper-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rust/16 font-bold text-rust">
      {initial}
    </div>
  );
}
