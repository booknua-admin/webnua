import Link from 'next/link';
import type { ReactNode } from 'react';

import { CALENDAR_TONE_BORDER_L } from '@/lib/calendar/tones';
import {
  CALENDAR_BOOKING_STATUS_LABEL,
  type CalendarTodayJob,
  type CalendarTodayPanel as CalendarTodayPanelData,
} from '@/lib/calendar/types';
import { cn } from '@/lib/utils';

type CalendarTodayPanelProps = {
  panel: CalendarTodayPanelData;
  /** Optional header-right affordance, e.g. an "Open calendar →" link. */
  action?: ReactNode;
  /** Drop the per-client logo column — redundant on a single-client surface
   *  (the overview hub) where every row is the same client. */
  hideClientLogo?: boolean;
  className?: string;
};

function CalendarTodayPanel({
  panel,
  action,
  hideClientLogo = false,
  className,
}: CalendarTodayPanelProps) {
  return (
    <div
      data-slot="calendar-today-panel"
      className={cn('rounded-[10px] border border-rule bg-card px-6 py-5.5', className)}
    >
      <div className="mb-3.5 flex items-center justify-between text-[17px] font-extrabold tracking-[-0.02em] text-ink">
        <span>{panel.heading}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-ink-quiet [&_strong]:text-rust">
            {panel.meta}
          </span>
          {action}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {panel.jobs.map((job) => (
          <CalendarTodayRow key={job.id} job={job} hideClientLogo={hideClientLogo} />
        ))}
      </div>
    </div>
  );
}

function CalendarTodayRow({
  job,
  hideClientLogo,
}: {
  job: CalendarTodayJob;
  hideClientLogo: boolean;
}) {
  const isCompleted = job.status === 'completed';
  const statusClasses = isCompleted ? 'bg-good-soft text-good' : 'bg-rust-soft text-rust';

  const rowClasses = cn(
    'grid items-center gap-3.5 rounded-lg border-l-[3px] bg-paper px-3.5 py-2.5',
    hideClientLogo ? 'grid-cols-[100px_1fr_auto_auto]' : 'grid-cols-[100px_36px_1fr_auto_auto]',
    CALENDAR_TONE_BORDER_L[job.tone],
    job.href && 'cursor-pointer transition-colors hover:bg-paper-2',
  );

  const body = (
    <>
      <div className="font-mono text-[12px] font-bold tracking-[0.02em] text-ink">{job.time}</div>
      {hideClientLogo ? null : (
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ink font-extrabold text-[12px] text-rust-light">
          {job.logoInitial}
        </div>
      )}
      <div className="text-[13px] text-ink">
        <strong className="font-bold">{job.title}</strong>{' '}
        <span className="text-ink-quiet">· {job.customer}</span>
      </div>
      <span
        className={cn(
          'rounded-full px-2 py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
          statusClasses,
        )}
      >
        {CALENDAR_BOOKING_STATUS_LABEL[job.status]}
      </span>
      <span className="text-[12px] font-bold text-rust">Open →</span>
    </>
  );

  if (job.href) {
    return (
      <Link href={job.href} className={rowClasses}>
        {body}
      </Link>
    );
  }
  return <div className={rowClasses}>{body}</div>;
}

export { CalendarTodayPanel };
export type { CalendarTodayPanelProps };
