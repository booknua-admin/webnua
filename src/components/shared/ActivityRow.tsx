import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Colour-keyed icon-tile tone. Deliberately a small colour vocabulary, not a
 *  category vocabulary — each consumer maps its own domain categories
 *  (campaign activity types, hub event kinds, …) onto these slots. */
type ActivityTone = 'info' | 'amber' | 'good' | 'rust';

/** One activity-feed row. Event-shaped on purpose (vision §7): a row is a
 *  typed, attributable event — id + actor + timestamp — not rendered prose,
 *  so the backend pass has a clean target. */
type ActivityRowData = {
  id: string;
  icon: ReactNode;
  tone: ActivityTone;
  /** The actor — rendered rust-bold, ahead of `body`. */
  actor?: ReactNode;
  /** Main line. `<strong>` renders bold. */
  body: ReactNode;
  /** Secondary line below `body`, quiet. */
  detail?: ReactNode;
  /** Right-aligned mono timestamp. */
  time: ReactNode;
  /** When set the whole row is a link. */
  href?: string;
};

type ActivityRowProps = {
  row: ActivityRowData;
  className?: string;
};

const TONE_CLASS: Record<ActivityTone, string> = {
  info: 'bg-info-soft text-info',
  amber: 'bg-[rgba(245,195,50,0.18)] text-[#b8870e]',
  good: 'bg-good-soft text-good',
  rust: 'bg-rust-soft text-rust',
};

function ActivityRow({ row, className }: ActivityRowProps) {
  const inner = (
    <>
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] font-bold',
          TONE_CLASS[row.tone],
        )}
      >
        {row.icon}
      </div>
      <div className="text-[13px] leading-[1.55] text-ink [&_strong]:font-bold">
        {row.actor ? <span className="font-bold text-rust">{row.actor}</span> : null}
        {row.actor ? ' ' : null}
        {row.body}
        {row.detail ? (
          <span className="mt-1 block text-[12px] leading-[1.45] text-ink-quiet">{row.detail}</span>
        ) : null}
      </div>
      <span className="mt-1.5 whitespace-nowrap text-right font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-quiet">
        {row.time}
      </span>
    </>
  );

  const baseClass = cn(
    'grid grid-cols-[32px_1fr_auto] items-start gap-3.5 border-b border-dotted border-rule py-3.5 last:border-b-0',
    className,
  );

  if (row.href) {
    return (
      <Link
        href={row.href}
        data-slot="activity-row"
        className={cn(baseClass, 'transition-colors hover:bg-paper-2/50')}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div data-slot="activity-row" className={baseClass}>
      {inner}
    </div>
  );
}

export { ActivityRow };
export type { ActivityRowData, ActivityRowProps, ActivityTone };
