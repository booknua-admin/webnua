// =============================================================================
// Calendar anchor helpers — the focused date is held as a YYYY-MM-DD string
// (UTC) so it is stable as a React-Query key and survives navigation cleanly.
// =============================================================================

import type { CalendarView } from './types';

/** Today as a YYYY-MM-DD string (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Shift the anchor one step in `dir` (+1 = forward, -1 = back). The step size
 * depends on the view: a day, a week, or a month.
 */
export function shiftAnchor(
  iso: string,
  view: CalendarView,
  dir: 1 | -1,
): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (view === 'day') d.setUTCDate(d.getUTCDate() + dir);
  else if (view === 'week') d.setUTCDate(d.getUTCDate() + dir * 7);
  else d.setUTCMonth(d.getUTCMonth() + dir);
  return toIso(d);
}
