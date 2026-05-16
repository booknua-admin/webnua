import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { ActivityRow, type ActivityRowData } from './ActivityRow';

type ActivityFeedProps = {
  /** `<em>` renders rust. */
  title: ReactNode;
  /** Optional intro line. `<strong>` renders ink-bold. */
  sub?: ReactNode;
  /** Optional header-right affordance, e.g. an "All →" link. */
  action?: ReactNode;
  items: ActivityRowData[];
  className?: string;
};

/**
 * Canonical flat activity-log card — white-card surface, heading, and a stack
 * of dotted-rule `ActivityRow`s. Used by the client `/campaigns` activity log
 * and the single-client overview hub.
 *
 * Distinct from `leads/LeadTimeline`, which is intentionally NOT consolidated
 * here: a timeline (dot-spine, scheduled-future pending events, tinted
 * snippet quotes) is a different structural concern from a flat feed.
 */
function ActivityFeed({ title, sub, action, items, className }: ActivityFeedProps) {
  return (
    <div
      data-slot="activity-feed"
      className={cn('rounded-xl border border-rule bg-card px-6 py-5.5', className)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="text-[16px] font-extrabold tracking-[-0.015em] text-ink [&_em]:not-italic [&_em]:text-rust">
          {title}
        </div>
        {action}
      </div>
      {sub ? (
        <p className="mb-4.5 text-[13px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
          {sub}
        </p>
      ) : null}
      <div className="flex flex-col">
        {items.map((item) => (
          <ActivityRow key={item.id} row={item} />
        ))}
      </div>
    </div>
  );
}

export { ActivityFeed };
export type { ActivityFeedProps };
