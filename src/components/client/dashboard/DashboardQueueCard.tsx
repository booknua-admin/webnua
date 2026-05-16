import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import type {
  DashboardQueue,
  DashboardQueueItem,
  QueueItemTag,
} from '@/lib/dashboard/client-dashboard-types';
import { cn } from '@/lib/utils';

type DashboardQueueCardProps = {
  queue: DashboardQueue;
  className?: string;
};

const AVATAR_TONE: Record<NonNullable<DashboardQueueItem['avatarTone']>, string> = {
  good: 'bg-good-soft text-good',
  rust: 'bg-rust-soft text-rust',
};

const TAG_TONE: Record<QueueItemTag['tone'], string> = {
  urgent: 'text-warn',
  done: 'text-good',
  next: 'text-rust',
};

function QueueItemRow({ item }: { item: DashboardQueueItem }) {
  const inner = (
    <>
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold',
          item.avatarTone ? AVATAR_TONE[item.avatarTone] : 'bg-paper-2 text-ink',
        )}
      >
        {item.initial}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-bold leading-[1.3] text-ink">{item.title}</div>
        <div className="mt-[3px] truncate text-[12px] leading-[1.4] text-ink-quiet">
          {item.tag ? (
            <span
              className={cn(
                'font-mono text-[10px] font-bold uppercase tracking-[0.04em]',
                TAG_TONE[item.tag.tone],
              )}
            >
              {item.tag.label}
            </span>
          ) : null}
          {item.tag ? ' · ' : null}
          {item.sub}
        </div>
      </div>
      <span className="whitespace-nowrap text-right font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-quiet">
        {item.time}
      </span>
    </>
  );

  const baseClass =
    'grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dotted border-rule py-3 last:border-b-0';

  if (item.href) {
    return (
      <Link
        href={item.href}
        data-slot="queue-item"
        className={cn(baseClass, '-mx-2 rounded-md px-2 transition-colors hover:bg-paper-2/50')}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div data-slot="queue-item" className={baseClass}>
      {inner}
    </div>
  );
}

/**
 * A dashboard queue card — header (heading + count badge + link) over a list
 * of avatar rows. Used twice on the client dashboard: follow-ups due and
 * today's jobs (Screen 1).
 */
function DashboardQueueCard({ queue, className }: DashboardQueueCardProps) {
  return (
    <div
      data-slot="dashboard-queue-card"
      className={cn('rounded-xl border border-rule bg-card px-6 py-5', className)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-[-0.015em] text-ink">
          {queue.heading}
          <Badge>{queue.count}</Badge>
        </h2>
        <Link
          href={queue.link.href}
          className="font-mono text-[11px] font-bold uppercase tracking-[0.07em] text-rust transition-colors hover:text-rust-deep"
        >
          {queue.link.label}
        </Link>
      </div>
      <div className="flex flex-col">
        {queue.items.map((item) => (
          <QueueItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export { DashboardQueueCard };
export type { DashboardQueueCardProps };
