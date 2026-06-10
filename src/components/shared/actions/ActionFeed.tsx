'use client';

// =============================================================================
// ActionFeed — the approval-first card queue.
//
// The dashboard's "Ready for your review" feed: every pending AI-drafted
// action for the scope (one client / all accessible clients / one lead),
// urgent first. Self-hides when empty by default — the feed is a prompt to
// act, not a permanent fixture; pass `showEmpty` on dedicated surfaces that
// want the all-clear state.
// =============================================================================

import { Eyebrow } from '@/components/ui/eyebrow';
import { useSuggestedActions } from '@/lib/actions/queries';
import type { SuggestedActionKind } from '@/lib/actions/types';

import { ActionCard } from './ActionCard';

/** Ads governance is operator-only (managed-service model) — the client
 *  dashboard passes this so owners never see a card they can't approve. */
export const OPERATOR_ONLY_KINDS: readonly SuggestedActionKind[] = [
  'ads_budget',
  'ads_pause',
  'ads_creative_refresh',
];

export type ActionFeedProps = {
  /** Client UUID scope. Omit/null = every accessible client (operator). */
  clientId?: string | null;
  /** Scope to one entity (a lead detail surface). */
  sourceEntityId?: string;
  /** Drop kinds the viewer can't act on. */
  excludeKinds?: readonly SuggestedActionKind[];
  /** Heading above the cards. */
  title?: string;
  limit?: number;
  /** Render an all-clear card instead of hiding when the queue is empty. */
  showEmpty?: boolean;
};

export function ActionFeed({
  clientId,
  sourceEntityId,
  excludeKinds,
  title = 'Ready for your review',
  limit,
  showEmpty = false,
}: ActionFeedProps) {
  const { data: actions, isLoading } = useSuggestedActions({
    clientId,
    sourceEntityId,
    excludeKinds,
    limit,
  });

  if (isLoading) return null;
  const items = actions ?? [];
  if (items.length === 0 && !showEmpty) return null;

  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-baseline gap-2.5">
        <Eyebrow tone="rust" bullet>
          {title}
        </Eyebrow>
        {items.length > 0 ? (
          <span className="rounded-full bg-rust px-2 py-0.5 font-mono text-[10px] font-bold text-paper">
            {items.length}
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule bg-card px-5 py-6 text-center font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          All clear — nothing waiting on you
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((action) => (
            <ActionCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </section>
  );
}
