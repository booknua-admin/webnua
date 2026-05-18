// =============================================================================
// Relative-time formatting. Every table stores absolute `timestamptz`; the
// front end computes the short relative labels the UI shows (design doc §5
// #13 — "32m", "2h", "Yesterday", "3d").
// =============================================================================

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * A compact relative label for an ISO timestamp — the inbox-row vocabulary:
 * `now`, `32m`, `2h`, `Yesterday`, `3d`, `2w`, then an absolute date.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diff = now - then;
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d`;
  if (diff < 4 * WEEK) return `${Math.floor(diff / WEEK)}w`;

  return new Date(then).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  });
}
