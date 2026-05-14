import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type {
  LeadTimelineDot,
  LeadTimelineEvent,
} from '@/lib/leads/types';

const DOT_STYLES: Record<LeadTimelineDot, string> = {
  'sms-in': 'bg-info/[0.14] text-info border-info/30',
  'sms-out': 'bg-rust/[0.12] text-rust border-rust/30',
  form: 'bg-good/[0.14] text-good border-good/30',
  status: 'bg-ink/[0.06] text-ink border-ink/15',
  email: 'bg-info/[0.14] text-info border-info/30',
  'scheduled-sms': 'bg-paper-2 text-ink-quiet border-rule',
  'scheduled-email': 'bg-paper-2 text-ink-quiet border-rule',
};

const DOT_GLYPH: Record<LeadTimelineDot, string> = {
  'sms-in': '↑',
  'sms-out': '↓',
  form: '▤',
  status: '○',
  email: '✉',
  'scheduled-sms': '◷',
  'scheduled-email': '◷',
};

type LeadTimelineProps = {
  heading?: string;
  count: number;
  events: LeadTimelineEvent[];
  className?: string;
};

function LeadTimeline({
  heading = 'Activity timeline',
  count,
  events,
  className,
}: LeadTimelineProps) {
  return (
    <div
      data-slot="lead-timeline"
      className={cn('px-7 py-6', className)}
    >
      <div className="mb-4 flex items-center justify-between text-[15px] font-semibold text-ink">
        <span>{heading}</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {count} EVENTS · NEWEST FIRST
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {events.map((event) => (
          <LeadTimelineEventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

type LeadTimelineEventRowProps = {
  event: LeadTimelineEvent;
  className?: string;
};

function LeadTimelineEventRow({ event, className }: LeadTimelineEventRowProps) {
  const hasRight = !!event.rightTime;
  return (
    <div
      data-slot="lead-timeline-event"
      data-pending={event.pending || undefined}
      className={cn(
        'grid items-start gap-3.5',
        hasRight
          ? 'grid-cols-[28px_1fr_90px]'
          : 'grid-cols-[28px_1fr]',
        event.pending && 'opacity-55',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold',
          DOT_STYLES[event.dot],
        )}
      >
        {DOT_GLYPH[event.dot]}
      </div>
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet [&_em]:not-italic [&_em]:text-rust">
          {event.meta}
          {event.auto ? (
            <span className="inline-flex items-center rounded-full bg-rust/[0.14] px-1.5 py-[1px] text-[9px] font-bold text-rust">
              ⤿ AUTO
            </span>
          ) : null}
        </div>
        {event.body ? (
          <div className="mb-2 text-[13px] text-ink [&_em]:not-italic [&_em]:font-semibold [&_em]:text-rust [&_strong]:font-semibold [&_strong]:text-ink">
            {event.body}
          </div>
        ) : null}
        {event.snippet ? (
          <LeadTimelineSnippet dot={event.dot}>
            {event.snippet}
          </LeadTimelineSnippet>
        ) : null}
      </div>
      {hasRight ? (
        <div className="text-right font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet [&_strong]:block [&_strong]:font-semibold [&_strong]:text-ink">
          {event.rightTime}
        </div>
      ) : null}
    </div>
  );
}

const SNIPPET_STYLES: Partial<Record<LeadTimelineDot, string>> = {
  'sms-in': 'border-info/15 bg-info/[0.05]',
  'sms-out': 'border-rust/20 bg-rust/[0.04]',
  form: 'border-good/15 bg-good/[0.05]',
  email: 'border-info/15 bg-info/[0.05]',
};

function LeadTimelineSnippet({
  dot,
  children,
}: {
  dot: LeadTimelineDot;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="lead-timeline-snippet"
      className={cn(
        'rounded-[10px] border px-3.5 py-3 text-[13px] leading-[1.5] text-ink [&_strong]:font-semibold [&_strong]:text-ink',
        SNIPPET_STYLES[dot] ?? 'border-rule bg-paper-2',
      )}
    >
      {children}
    </div>
  );
}

export { LeadTimeline, LeadTimelineEventRow };
export type { LeadTimelineProps };
