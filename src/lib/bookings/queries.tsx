// =============================================================================
// Bookings + calendar cluster — data access (Phase 3).
//
// The week calendar and the booking detail read the `bookings` table; RLS
// bounds the rows (a client sees only their own client's bookings, an
// operator sees every accessible client) — so the same query is correct for
// both views, and the dispatch picks only which shape to map to.
//
// Pixel layout (`top` / `height` / `nowTopPx`) is never stored — design §5
// #11: it is computed here from `starts_at` / `ends_at`. Relative labels are
// likewise computed (§5 #13). The seed stores wall-clock times in UTC, so the
// hour-of-day is read with the UTC accessors (no local-zone shift).
//
// queryFn throws `AppError`; a by-id `.single()` that finds no row resolves
// as `not_found` (errors.ts / design §8).
// =============================================================================

import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type {
  AdminBookingDetail,
  BookingHistoryItemGrid,
  BookingJobCell,
  BookingRailRow,
  ClientBookingActionGroup,
  ClientBookingDetail,
} from './types';
import type {
  CalendarBooking,
  CalendarClientFilter,
  CalendarClientTone,
  CalendarDay,
  CalendarLegendItem,
  CalendarTodayJob,
  CalendarTodayPanel,
  CalendarWeek,
} from '@/lib/calendar/types';

// ---- Calendar geometry ------------------------------------------------------

const DAY_START_HOUR = 7; // 7:00 sits at the top of a day column
const HOUR_PX = 50;
const TIME_SLOTS = [
  '7:00',
  '8:00',
  '9:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];

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
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Minutes-since-midnight, read in UTC so the seed's wall-clock survives. */
function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function clockLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h}:${String(m).padStart(2, '0')}`;
}

function timeRange(startIso: string, endIso: string): string {
  return `${clockLabel(startIso)} — ${clockLabel(endIso)}`;
}

function topPx(iso: string): number {
  return Math.max(0, (minutesOfDay(iso) - DAY_START_HOUR * 60) * (HOUR_PX / 60));
}

function heightPx(startIso: string, endIso: string): number {
  const mins = minutesOfDay(endIso) - minutesOfDay(startIso);
  return Math.max(20, mins * (HOUR_PX / 60));
}

/** Monday 00:00 UTC of the week containing `now`. */
function weekStart(now: Date): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const shift = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}

function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---- Client identity tone ---------------------------------------------------

const KNOWN_TONES = new Set<CalendarClientTone>([
  'voltline',
  'freshhome',
  'keyhero',
  'neatworks',
]);

function toClientTone(slug: string): CalendarClientTone {
  return KNOWN_TONES.has(slug as CalendarClientTone)
    ? (slug as CalendarClientTone)
    : 'generic';
}

const BOOKING_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  standard: 'Standard',
  quick: 'Quick job',
  quote: 'Quote visit',
  emergency: 'Emergency call-out',
  recurring: 'Recurring',
  one_off: 'One-off',
  custom: 'Custom',
};

function serviceLabel(serviceType: string): string {
  return SERVICE_TYPE_LABEL[serviceType] ?? serviceType;
}

function lastName(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  );
}

function formatPrice(price: number | null): string {
  if (price == null) return 'Not set';
  const rounded = Math.round(price * 100) / 100;
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}

function formatDuration(startIso: string, endIso: string): string {
  const hours = (minutesOfDay(endIso) - minutesOfDay(startIso)) / 60;
  const label = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  return `${label} ${hours === 1 ? 'hour' : 'hours'}`;
}

// =============================================================================
// Calendar — the week grid. The same `bookings` fetch (range-bounded to the
// current week) serves both roles; the role hook builds the role's shape.
// =============================================================================

type CalendarBookingRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_name_snapshot: string;
  client: { name: string; slug: string } | null;
  customer: { suburb: string | null } | null;
};

const CALENDAR_SELECT =
  'id, title, starts_at, ends_at, status, customer_name_snapshot, ' +
  'client:clients(name, slug), customer:customers(suburb)';

async function fetchWeekBookings(): Promise<CalendarBookingRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const start = weekStart(new Date());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const { data, error } = await supabase
    .from('bookings')
    .select(CALENDAR_SELECT)
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });

  if (error) throw normalizeError(error);
  return data as unknown as CalendarBookingRow[];
}

function customerCell(row: CalendarBookingRow): string {
  const name = lastName(row.customer_name_snapshot);
  const suburb = row.customer?.suburb;
  return suburb ? `${name} · ${suburb}` : name;
}

/** Build the Mon–Sat week grid from the fetched rows. */
function buildWeek(rows: CalendarBookingRow[], cornerLabel: string): CalendarWeek {
  const now = new Date();
  const start = weekStart(now);
  const todayKey = utcDateKey(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );

  const days: CalendarDay[] = [];
  for (let i = 0; i < 6; i += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const key = utcDateKey(date);
    const isToday = key === todayKey;

    const bookings: CalendarBooking[] = rows
      .filter((r) => r.starts_at.slice(0, 10) === key)
      .map((r) => ({
        id: r.id,
        time: timeRange(r.starts_at, r.ends_at),
        title: r.title,
        customer: customerCell(r),
        top: topPx(r.starts_at),
        height: heightPx(r.starts_at, r.ends_at),
        tone: toClientTone(r.client?.slug ?? 'generic'),
        href: `/bookings/${r.id}`,
      }));

    const day: CalendarDay = {
      id: WEEKDAY[date.getUTCDay()]!.toLowerCase(),
      name: isToday
        ? `${WEEKDAY[date.getUTCDay()]!.toUpperCase()} · TODAY`
        : WEEKDAY[date.getUTCDay()]!.toUpperCase(),
      num: String(date.getUTCDate()),
      bookings,
    };
    if (isToday) {
      day.isToday = true;
      const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes();
      day.nowTopPx = Math.max(
        0,
        (nowMins - DAY_START_HOUR * 60) * (HOUR_PX / 60),
      );
      day.nowLabel = `NOW · ${now.getUTCHours()}:${String(
        now.getUTCMinutes(),
      ).padStart(2, '0')}`;
    }
    days.push(day);
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 5);
  return {
    cornerLabel,
    periodLabel: (
      <>
        Week of{' '}
        <em>
          {MONTH[start.getUTCMonth()]} {start.getUTCDate()}
        </em>{' '}
        — {MONTH[end.getUTCMonth()]} {end.getUTCDate()},{' '}
        {end.getUTCFullYear()}
      </>
    ),
    timeSlots: TIME_SLOTS,
    days,
  };
}

/** The client week calendar — RLS bounds rows to the signed-in client. */
export function useClientCalendar() {
  return useQuery({
    queryKey: ['bookings', 'calendar'],
    queryFn: fetchWeekBookings,
    select: (rows) => buildWeek(rows, '// PERTH'),
  });
}

export type AdminCalendarData = {
  week: CalendarWeek;
  filters: CalendarClientFilter[];
  legend: CalendarLegendItem[];
  legendMeta: ReactNode;
  today: CalendarTodayPanel;
};

function buildAdminCalendar(rows: CalendarBookingRow[]): AdminCalendarData {
  const week = buildWeek(rows, '// LOCAL');

  // Client filter chips + legend, derived from the clients with bookings.
  const clients = new Map<string, { name: string; tone: CalendarClientTone }>();
  for (const r of rows) {
    const slug = r.client?.slug ?? 'generic';
    if (!clients.has(slug)) {
      clients.set(slug, {
        name: r.client?.name ?? 'Unknown',
        tone: toClientTone(slug),
      });
    }
  }
  const filters: CalendarClientFilter[] = [
    { id: 'all', label: 'All clients', count: clients.size },
    ...[...clients].map(([slug, c]) => ({ id: slug, label: c.name })),
  ];
  const legend: CalendarLegendItem[] = [...clients.values()].map((c) => ({
    label: c.name,
    tone: c.tone,
  }));

  // Today panel.
  const now = new Date();
  const todayKey = utcDateKey(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );
  const todayRows = rows.filter((r) => r.starts_at.slice(0, 10) === todayKey);
  const jobs: CalendarTodayJob[] = todayRows.map((r) => ({
    id: r.id,
    time: timeRange(r.starts_at, r.ends_at),
    logoInitial: (r.client?.name?.[0] ?? '?').toUpperCase(),
    title: r.title,
    customer: customerCell(r),
    status:
      r.status === 'in_progress'
        ? 'in_progress'
        : r.status === 'completed'
          ? 'completed'
          : 'scheduled',
    tone: toClientTone(r.client?.slug ?? 'generic'),
    href: `/bookings/${r.id}`,
  }));
  const doneCount = jobs.filter((j) => j.status === 'completed').length;

  const today: CalendarTodayPanel = {
    heading: `Today · ${WEEKDAY[now.getUTCDay()]}, ${
      MONTH_LONG[now.getUTCMonth()]
    } ${now.getUTCDate()}`,
    meta: (
      <>
        {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} ·{' '}
        <strong>{doneCount} done</strong> · {jobs.length - doneCount} pending
      </>
    ),
    jobs,
  };

  return {
    week,
    filters,
    legend,
    legendMeta: (
      <>
        {rows.length} {rows.length === 1 ? 'booking' : 'bookings'} this week ·{' '}
        {todayRows.length} today
      </>
    ),
    today,
  };
}

/** The operator cross-client week calendar — RLS bounds rows to the
 *  operator's accessible clients. */
export function useAdminCalendar() {
  return useQuery({
    queryKey: ['bookings', 'calendar'],
    queryFn: fetchWeekBookings,
    select: buildAdminCalendar,
  });
}

// =============================================================================
// Booking detail — one booking + the customer's job history. RLS makes the
// by-id fetch return nothing (→ not_found) for a booking outside the tenant.
// =============================================================================

type BookingDetailRow = {
  id: string;
  title: string;
  service_type: string;
  status: string;
  starts_at: string;
  ends_at: string;
  price: number | null;
  notes: string | null;
  address: string | null;
  customer_id: string;
  customer_name_snapshot: string;
  customer_phone_snapshot: string | null;
  lead_id: string | null;
  client: { name: string; slug: string } | null;
  customer: {
    suburb: string | null;
    email: string | null;
    address: string | null;
    created_at: string;
  } | null;
};

const DETAIL_SELECT =
  'id, title, service_type, status, starts_at, ends_at, price, notes, ' +
  'address, customer_id, customer_name_snapshot, customer_phone_snapshot, ' +
  'lead_id, client:clients(name, slug), ' +
  'customer:customers(suburb, email, address, created_at)';

type HistoryRow = {
  id: string;
  title: string;
  price: number | null;
  status: string;
  starts_at: string;
};

export type BookingDetailRecord = {
  booking: BookingDetailRow;
  history: HistoryRow[];
};

async function fetchBookingDetail(id: string): Promise<BookingDetailRecord> {
  const { data, error } = await supabase
    .from('bookings')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .single();
  if (error) throw normalizeError(error);
  const booking = data as unknown as BookingDetailRow;

  // The customer's other bookings — job history + lifetime-value rail.
  const { data: historyData, error: historyError } = await supabase
    .from('bookings')
    .select('id, title, price, status, starts_at')
    .eq('customer_id', booking.customer_id)
    .neq('id', booking.id)
    .order('starts_at', { ascending: false });
  if (historyError) throw normalizeError(historyError);

  return { booking, history: historyData as HistoryRow[] };
}

function dateLabelLong(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function dateLabelShort(iso: string): string {
  const d = new Date(iso);
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY[d.getUTCDay()]} ${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// ---- Client detail ----------------------------------------------------------

function buildClientBookingDetail(
  record: BookingDetailRecord,
): ClientBookingDetail {
  const b = record.booking;
  const suburb = b.customer?.suburb ?? '';
  const first = b.customer_name_snapshot.trim().split(/\s+/)[0] ?? '';

  const contactParts: ReactNode[] = [];
  if (b.customer_phone_snapshot) {
    contactParts.push(<strong key="p">{b.customer_phone_snapshot}</strong>);
  }
  if (b.customer?.email) contactParts.push(b.customer.email);
  if (suburb) contactParts.push(suburb);
  const contact: ReactNode[] = contactParts.flatMap((part, i) =>
    i === 0 ? [part] : [' · ', part],
  );

  const job: BookingJobCell[] = [
    { label: 'SERVICE', value: serviceLabel(b.service_type) },
    {
      label: 'PRICE',
      value: <em>{formatPrice(b.price)}</em>,
    },
    { label: 'DURATION', value: formatDuration(b.starts_at, b.ends_at) },
    { label: 'PAYMENT', value: 'On completion' },
  ];

  const history = record.history.map((h) => ({
    date: dateLabelLong(h.starts_at),
    body: (
      <>
        {h.title} · {formatPrice(h.price)}
      </>
    ),
  }));

  const statusLabel =
    b.status === 'scheduled'
      ? `Scheduled · ${dayLabel(b.starts_at)}`
      : (BOOKING_STATUS_LABEL[b.status] ?? b.status);

  const actions: ClientBookingActionGroup[] = [
    {
      heading: '// ON ARRIVAL',
      actions: [
        { icon: '✓', label: 'Mark job complete', tone: 'primary' },
        { icon: '☏', label: `Call ${first}` },
        { icon: '✉', label: 'Send "running late" SMS' },
      ],
    },
    {
      heading: '// MANAGE',
      actions: [
        { icon: '▤', label: 'Reschedule' },
        { icon: '✎', label: 'Edit job notes' },
        { icon: '×', label: 'Cancel booking', tone: 'danger' },
      ],
    },
  ];

  return {
    tag: `// CALENDAR · ${dayLabel(b.starts_at).toUpperCase()} · ${timeRange(
      b.starts_at,
      b.ends_at,
    )}`,
    title: b.title,
    meta: {
      customer: b.customer_name_snapshot,
      suburb,
      price: `${formatPrice(b.price)} quoted`,
      duration: formatDuration(b.starts_at, b.ends_at),
    },
    statusLabel,
    customer: {
      initial: initials(b.customer_name_snapshot),
      name: b.customer_name_snapshot,
      phone: b.customer_phone_snapshot ?? '',
      contact: <>{contact}</>,
    },
    job,
    notes: b.notes ?? 'No notes on this booking.',
    notesText: b.notes ?? '',
    history,
    actions,
    nextNote: (
      <>
        When you mark this job complete, the{' '}
        <strong>review request automation fires shortly after</strong> with a
        direct link to your Google review page.
      </>
    ),
  };
}

// ---- Admin detail -----------------------------------------------------------

function buildAdminBookingDetail(
  record: BookingDetailRecord,
): AdminBookingDetail {
  const b = record.booking;
  const completed = record.history.filter((h) => h.status === 'completed');
  const lifetimeSpend = completed.reduce((sum, h) => sum + (h.price ?? 0), 0);

  const details: BookingJobCell[] = [
    { label: '// SERVICE TYPE', value: serviceLabel(b.service_type) },
    { label: '// PRICE', value: formatPrice(b.price) },
    {
      label: '// ESTIMATED TIME',
      value: formatDuration(b.starts_at, b.ends_at),
    },
    { label: '// STATUS', value: BOOKING_STATUS_LABEL[b.status] ?? b.status },
    { label: '// PAYMENT', value: 'Card · auto-bill on completion' },
    {
      label: '// ADDRESS',
      value: b.address ?? b.customer?.address ?? 'Not recorded',
    },
  ];

  const history: BookingHistoryItemGrid[] = record.history
    .slice(0, 6)
    .map((h) => ({
      date: dateLabelShort(h.starts_at),
      title: h.title,
      price: formatPrice(h.price),
      status: h.status === 'completed' ? 'done' : 'scheduled',
    }));

  const customerValue: BookingRailRow[] = [
    {
      label: 'Lifetime spend',
      value: formatPrice(lifetimeSpend),
      accent: true,
    },
    { label: 'Jobs done', value: String(completed.length) },
    {
      label: 'Bookings total',
      value: String(record.history.length + 1),
    },
    {
      label: 'Customer since',
      value: b.customer
        ? `${MONTH[new Date(b.customer.created_at).getUTCMonth()]} ${new Date(
            b.customer.created_at,
          ).getUTCFullYear()}`
        : '—',
    },
  ];

  const automations: BookingRailRow[] = [
    {
      label: 'SMS reminder',
      value:
        b.status === 'scheduled' ? 'Before the job' : 'Sent',
    },
    { label: 'Review request', value: 'After complete' },
  ];

  return {
    hero: {
      eyebrow: `Calendar · ${dayLabel(b.starts_at)} · ${clockLabel(
        b.starts_at,
      )}`,
      title: (
        <>
          Booking <em>detail</em>.
        </>
      ),
      subtitle: (
        <>
          Full detail for one booked job —{' '}
          <strong>job notes, customer history, and the actions</strong> you
          can take. Reachable from any block on the calendar.
        </>
      ),
    },
    tone: toClientTone(b.client?.slug ?? 'generic'),
    timeRow: (
      <>
        {dayLabel(b.starts_at)} ·{' '}
        <strong>{timeRange(b.starts_at, b.ends_at)}</strong> ·{' '}
        {formatDuration(b.starts_at, b.ends_at)}
      </>
    ),
    jobTitle: b.title,
    customer: {
      name: b.customer_name_snapshot,
      phone: b.customer_phone_snapshot ?? '—',
      suburb: b.customer?.suburb ?? '',
      clientPill: b.client?.name ?? 'Client',
    },
    details,
    notes: b.notes ?? 'No customer notes on this booking.',
    historyHeading: `// JOB HISTORY · ${record.history.length} PREVIOUS`,
    history,
    customerValue,
    location: {
      address: b.address ?? b.customer?.address ?? 'Address not recorded',
    },
    automations,
  };
}

/** One booking as the client sees it. RLS scopes the by-id fetch to the
 *  caller's tenant; a booking outside it resolves as not_found. */
export function useClientBookingDetail(id: string) {
  return useQuery({
    queryKey: ['bookings', 'detail', id],
    queryFn: () => fetchBookingDetail(id),
    enabled: id.length > 0,
    select: buildClientBookingDetail,
  });
}

/** One booking as the operator sees it. */
export function useAdminBookingDetail(id: string) {
  return useQuery({
    queryKey: ['bookings', 'detail', id],
    queryFn: () => fetchBookingDetail(id),
    enabled: id.length > 0,
    select: buildAdminBookingDetail,
  });
}
