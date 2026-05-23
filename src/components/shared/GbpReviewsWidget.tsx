'use client';

// =============================================================================
// GbpReviewsWidget — the "rating · review count · new this week" widget.
//
// Phase 7 GBP. Mountable on any dashboard surface — currently the operator
// hub (sub-account `/dashboard`) and the client `/dashboard`. Renders three
// quick numbers + a link to the full reviews surface; null when there is
// no connected GBP location yet (so a freshly-onboarded client doesn't see
// an empty placeholder).
// =============================================================================

import Link from 'next/link';

import { RailCard } from '@/components/shared/RailCard';
import {
  useClientGbpLocation,
  useNewGbpReviewsCount,
} from '@/lib/integrations/gbp/use-gbp';

export function GbpReviewsWidget({
  clientId,
  /** Where the "Open reviews →" link goes. Defaults to the operator
   *  surface; pass the client dashboard equivalent for the customer view. */
  href = '/settings/google-business',
}: {
  clientId: string | null;
  href?: string;
}) {
  const location = useClientGbpLocation(clientId);
  const newCount = useNewGbpReviewsCount(clientId);
  const row = location.data ?? null;

  // No connected GBP location — hide entirely. A "Connect now" CTA could
  // live here in a future polish pass; for V1, silent absence keeps the
  // dashboard honest.
  if (location.isLoading) {
    return (
      <RailCard heading="// Google reviews">
        <div className="text-[12px] text-ink-quiet">Loading…</div>
      </RailCard>
    );
  }
  if (!row) {
    return null;
  }

  return (
    <RailCard heading="// Google reviews">
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[28px] font-bold text-ink">
            {row.current_rating != null ? row.current_rating.toFixed(1) : '—'}
          </span>
          <span className="font-mono text-[14px] text-amber">★★★★★</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
              Total reviews
            </div>
            <div className="font-mono text-[18px] font-bold text-ink">
              {row.review_count}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
              New since last view
            </div>
            <div
              className={
                'font-mono text-[18px] font-bold ' +
                (newCount && newCount > 0 ? 'text-rust' : 'text-ink')
              }
            >
              {newCount ?? '—'}
            </div>
          </div>
        </div>
        <Link
          href={href}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.07em] text-rust transition-colors hover:text-rust-deep"
        >
          Open reviews →
        </Link>
      </div>
    </RailCard>
  );
}
