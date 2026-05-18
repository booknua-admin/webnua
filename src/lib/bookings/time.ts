// =============================================================================
// Wall-clock-in-UTC timestamp helpers for the booking write flows.
//
// The calendar reads booking times with the UTC accessors (queries.tsx), so
// the form inputs compose and decompose the same way: a date + time the
// operator types is the wall-clock value, stored verbatim in UTC. No local
// timezone shift creeps in either direction.
// =============================================================================

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A `YYYY-MM-DD` date + `HH:MM` time → an ISO timestamp, read as UTC. */
export function composeTimestamp(date: string, time: string): string {
  return new Date(`${date}T${time}:00.000Z`).toISOString();
}

/** ISO timestamp → the `YYYY-MM-DD` value for a native date input. */
export function isoToDateValue(iso: string): string {
  return iso.slice(0, 10);
}

/** ISO timestamp → the `HH:MM` value for a native time input. */
export function isoToTimeValue(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "13:00 — 15:00" from two ISO timestamps. */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${clock(startIso)} — ${clock(endIso)}`;
}

function clock(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCHours()}:${pad(d.getUTCMinutes())}`;
}

/** "Wed, May 13" from an ISO timestamp. */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY[d.getUTCDay()]}, ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Thu 14 May" — the short label used in the recurring preview rows. */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

/** Minutes between two ISO timestamps. */
export function durationMinutes(startIso: string, endIso: string): number {
  return Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
}

/** Add minutes to an ISO timestamp. */
export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/** Add days to a `YYYY-MM-DD` date string, returning the same shape. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
