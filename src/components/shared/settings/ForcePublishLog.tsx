'use client';

// =============================================================================
// ForcePublishLog — read-only audit log of break-glass force-publish events.
//
// One row per entry. Mono timestamps, ink-bold actor + target, italic reason.
// Empty state shows a description of what the surface will hold once
// force-publish actions start firing (Session 5+).
// =============================================================================

import type { ForcePublishEntry } from '@/lib/auth/audit-stub';

export type ForcePublishLogProps = {
  entries: ForcePublishEntry[];
};

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return TIMESTAMP_FORMATTER.format(date);
}

export function ForcePublishLog({ entries }: ForcePublishLogProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-rule bg-paper px-5 py-6 text-[13px] text-ink-quiet">
        <p>
          No force-publish events. The break-glass &ldquo;Force publish (skip
          approval)&rdquo; action fires only when an admin overrides the
          approval queue. Every entry records actor, target page, free-text
          reason, and the resulting version id.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-paper">
      <div className="grid grid-cols-[160px_1fr_140px] gap-3 border-b border-rule bg-paper-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        <span>When</span>
        <span>Event</span>
        <span>Version</span>
      </div>
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          className={
            'grid grid-cols-[160px_1fr_140px] items-start gap-3 bg-card px-5 py-4' +
            (i < entries.length - 1 ? ' border-b border-paper-2' : '')
          }
        >
          <p className="font-mono text-[11px] text-ink-soft">
            {formatTimestamp(entry.at)}
          </p>
          <div>
            <p className="text-[13px] text-ink">
              <strong className="font-bold">{entry.actor.displayName}</strong>
              {' '}force-published{' '}
              <strong className="font-bold">{entry.target.pageTitle}</strong>
              {' '}for{' '}
              <strong className="font-bold text-rust">
                {entry.target.clientName}
              </strong>
              .
            </p>
            <p className="mt-1 text-[12px] italic text-ink-mid">
              &ldquo;{entry.reason}&rdquo;
            </p>
          </div>
          <p className="font-mono text-[11px] text-ink-quiet">
            {entry.newVersionId}
          </p>
        </div>
      ))}
    </div>
  );
}
