// =============================================================================
// Dashboard / hub cluster — data access (Phase 3).
//
// The client dashboard (Screen 1), the operator agency-mode roster, and the
// single-client overview hub (Screen 20) are all AGGREGATE READ-MODELS
// (design §5 #14): `ClientDashboard` / `ClientHub` / the admin roster are NOT
// tables — the backend composes them at query time from `leads` / `bookings`
// / `reviews` / `campaigns` / `websites` / `automations`. RLS bounds every
// underlying read; the hub additionally keys to the active sub-account client.
//
// SCHEMA GAP — performance metrics. There is no send-log / metrics table, so
// landing-page analytics (visits, conversion rate, page speed), ad ROAS, and
// automation send counts are not modelled. Those render honest "Awaiting …"
// placeholders; the leads / bookings / reviews aggregates ARE real and wired.
//
// queryFn throws `AppError`; React Query catches it into a typed `error`.
// =============================================================================

import { useQuery } from '@tanstack/react-query';

import type { ActivityRowData } from '@/components/shared/ActivityRow';
import {
  fetchSurfaceFunnelTotals,
  fetchSurfacePageTotals,
  formatDwell,
  pageSpeedScore,
  type SurfaceFunnelTotals,
  type SurfacePageTotals,
} from '@/lib/analytics/queries';
import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import type {
  AgencyTone,
  AgencyUrgent,
  AttentionPanelData,
  ClientPerformanceCardData,
  DashboardStat,
} from './admin-dashboard-types';
import type {
  ClientDashboard,
  DashboardCallout,
  DashboardQueueItem,
  LandingSnapshot,
  LandingSnapshotStat,
} from './client-dashboard-types';
import type {
  ClientHub,
  HubActivityEvent,
  HubContextCard,
  HubFunnelConversion,
  HubHeroStat,
  HubWeeklyStat,
  OperatorAction,
} from './hub-types';
import type {
  CalendarBookingStatus,
  CalendarTodayJob,
  CalendarTodayPanel,
} from '@/lib/calendar/types';

// ---- Time bucketing ---------------------------------------------------------

const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** Count items whose epoch ms falls in [now − (n+1)·WEEK, now − n·WEEK). */
function countInWeek(times: number[], weeksAgo: number, now: number): number {
  const end = now - weeksAgo * WEEK;
  const start = end - WEEK;
  return times.filter((t) => t >= start && t < end).length;
}

/** Sum `values` whose paired epoch ms falls in the same week window. */
function sumInWeek(
  rows: { t: number; v: number }[],
  weeksAgo: number,
  now: number,
): number {
  const end = now - weeksAgo * WEEK;
  const start = end - WEEK;
  return rows
    .filter((r) => r.t >= start && r.t < end)
    .reduce((s, r) => s + r.v, 0);
}

function ms(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

function isToday(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

// ---- Small formatters -------------------------------------------------------

const WEEKDAY = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
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

function greetingTag(now: Date): string {
  const time = now.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `// ${WEEKDAY[now.getDay()]} · ${time}`;
}

/** "Morning" / "Afternoon" / "Evening" — the greeting word. */
function greetingWord(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

/** "MAY 7–13" — the last seven days ending today. */
function weekRangeLabel(now: Date): string {
  const start = new Date(now.getTime() - 6 * DAY);
  if (start.getMonth() === now.getMonth()) {
    return `${MONTH[now.getMonth()].toUpperCase()} ${start.getDate()}–${now.getDate()}`;
  }
  return `${MONTH[start.getMonth()].toUpperCase()} ${start.getDate()} – ${MONTH[
    now.getMonth()
  ].toUpperCase()} ${now.getDate()}`;
}

function periodLabel(now: Date): string {
  const start = new Date(now.getTime() - 6 * DAY);
  return `${MONTH[start.getMonth()]} ${start.getDate()}–${now.getDate()}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
  );
}

function clockLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-AU')}`;
}

function deltaLabel(current: number, prior: number): {
  direction: 'up' | 'down' | 'flat';
  label: string;
} {
  const diff = current - prior;
  if (diff > 0) return { direction: 'up', label: `${diff} vs last wk` };
  if (diff < 0) return { direction: 'down', label: `${-diff} vs last wk` };
  return { direction: 'flat', label: 'level vs last wk' };
}

// ---- Shared row shapes ------------------------------------------------------

type LeadRow = {
  id: string;
  status: string;
  urgency: string;
  source: string | null;
  customer_name_snapshot: string;
  created_at: string;
  customer: { suburb: string | null } | null;
};

type BookingRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_name_snapshot: string;
  price: number | null;
  created_at: string;
  customer: { suburb: string | null } | null;
};

type ReviewRow = {
  id: string;
  author_name: string;
  stars: number;
  reviewed_at: string;
};

type CompletionRow = { amount_charged: number | null; completed_at: string };

const LEAD_SELECT =
  'id, status, urgency, source, customer_name_snapshot, created_at, ' +
  'customer:customers(suburb)';
const BOOKING_SELECT =
  'id, title, starts_at, ends_at, status, customer_name_snapshot, price, ' +
  'created_at, customer:customers(suburb)';
const REVIEW_SELECT = 'id, author_name, stars, reviewed_at';

// ---- Derivations shared by dashboard + hub ----------------------------------

function bookingStatus(status: string): CalendarBookingStatus {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  return 'scheduled';
}

/** Today's jobs, ordered by start time, as a `CalendarTodayPanel`. */
function todayPanel(
  bookings: BookingRow[],
  now: Date,
  logoInitial: string,
  tone: CalendarTodayJob['tone'],
): CalendarTodayPanel {
  const jobs = bookings
    .filter((b) => isToday(b.starts_at, now) && b.status !== 'cancelled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const done = jobs.filter((j) => j.status === 'completed').length;

  return {
    heading: "Today's schedule",
    meta: `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} · ${done} done · ${
      jobs.length - done
    } to go`,
    jobs: jobs.map((b) => ({
      id: b.id,
      time: `${clockLabel(b.starts_at)} — ${clockLabel(b.ends_at)}`,
      logoInitial,
      title: b.title,
      customer: `${b.customer_name_snapshot}${
        b.customer?.suburb ? ` · ${b.customer.suburb}` : ''
      }`,
      status: bookingStatus(b.status),
      tone,
      href: `/bookings/${b.id}`,
    })),
  };
}

/** Weekly-stat trend [3w, 2w, 1w, now] for a list of timestamps. */
function weeklyCounts(times: number[], now: number): number[] {
  return [3, 2, 1, 0].map((w) => countInWeek(times, w, now));
}

/** The conversion funnel. The bottom three stages (form submitted → booked →
 *  reviewed) are always real — sourced from `leads` / `bookings` / `reviews`.
 *  The top three (landing → engaged → form-started) are visitor-tracking
 *  rollups (visitor-tracking-design §7); they render only once a surface has
 *  tracked traffic. With no tracked data the funnel honestly falls back to
 *  the three live stages it has always shown. */
function conversionFunnel(
  domain: string,
  now: Date,
  leadCount: number,
  bookedCount: number,
  reviewCount: number,
  tracked: SurfaceFunnelTotals | null,
): HubFunnelConversion {
  const hasTracked = !!tracked?.hasData && tracked.landing > 0;

  if (!hasTracked) {
    const top = Math.max(leadCount, 1);
    const pct = (n: number): number => Math.round((n / top) * 1000) / 10;
    return {
      domain,
      periodLabel: periodLabel(now),
      steps: [
        {
          kind: 'leads',
          label: 'New leads',
          sublabel: 'Funnel form submitted',
          count: leadCount,
          pct: 100,
        },
        {
          kind: 'booked',
          label: 'Booked',
          sublabel: 'Converted to a job',
          count: bookedCount,
          pct: pct(bookedCount),
        },
        {
          kind: 'reviewed',
          label: 'Reviewed',
          sublabel: '5★ Google review',
          count: reviewCount,
          pct: pct(reviewCount),
        },
      ],
    };
  }

  const top = tracked.landing;
  const pct = (n: number): number =>
    Math.min(100, Math.round((n / top) * 1000) / 10);
  return {
    domain,
    periodLabel: periodLabel(now),
    steps: [
      {
        kind: 'landing',
        label: 'Landing visits',
        sublabel: 'Arrived on the page',
        count: tracked.landing,
        pct: 100,
      },
      {
        kind: 'engaged',
        label: 'Engaged',
        sublabel: 'Scrolled past halfway',
        count: tracked.engaged,
        pct: pct(tracked.engaged),
      },
      {
        kind: 'form-started',
        label: 'Form started',
        sublabel: 'Began typing details',
        count: tracked.formStarted,
        pct: pct(tracked.formStarted),
      },
      {
        kind: 'leads',
        label: 'Form submitted',
        sublabel: 'Became a new lead',
        count: leadCount,
        pct: pct(leadCount),
      },
      {
        kind: 'booked',
        label: 'Booked',
        sublabel: 'Converted to a job',
        count: bookedCount,
        pct: pct(bookedCount),
      },
      {
        kind: 'reviewed',
        label: 'Reviewed',
        sublabel: '5★ Google review',
        count: reviewCount,
        pct: pct(reviewCount),
      },
    ],
  };
}

/** Recent activity feed — merged reviews + leads, newest first. */
function activityFeed(
  leads: LeadRow[],
  reviews: ReviewRow[],
  limit: number,
): HubActivityEvent[] {
  const events: { at: number; event: HubActivityEvent }[] = [];

  for (const r of reviews) {
    events.push({
      at: ms(r.reviewed_at),
      event: {
        id: `act-review-${r.id}`,
        kind: 'review',
        actor: r.author_name,
        body: `left a ${r.stars}-star review`,
        time: relativeTime(r.reviewed_at),
      },
    });
  }
  for (const l of leads) {
    events.push({
      at: ms(l.created_at),
      event: {
        id: `act-lead-${l.id}`,
        kind: 'lead',
        actor: l.customer_name_snapshot,
        body: `submitted a new lead${
          l.customer?.suburb ? ` · ${l.customer.suburb}` : ''
        }`,
        time: relativeTime(l.created_at),
      },
    });
  }

  return events
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((e) => e.event);
}

// =============================================================================
// Client dashboard — the signed-in client's home (Screen 1).
// =============================================================================

type ClientDashboardJoin = {
  client: { name: string; slug: string } | null;
  leads: LeadRow[];
  bookings: BookingRow[];
  reviews: ReviewRow[];
  completions: CompletionRow[];
  websiteDomain: string | null;
  ownerName: string;
  /** Tracked top-of-funnel + page-engagement totals (visitor-tracking §7).
   *  null when the client has no website. */
  funnelTotals: SurfaceFunnelTotals | null;
  pageTotals: SurfacePageTotals | null;
};

async function fetchClientDashboard(): Promise<ClientDashboard> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const [
    userResult,
    clientResult,
    leadsResult,
    bookingsResult,
    reviewsResult,
    completionsResult,
    websiteResult,
  ] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', user.id).single(),
    supabase.from('clients').select('name, slug'),
    supabase.from('leads').select(LEAD_SELECT),
    supabase.from('bookings').select(BOOKING_SELECT),
    supabase.from('reviews').select(REVIEW_SELECT),
    supabase.from('job_completions').select('amount_charged, completed_at'),
    supabase.from('websites').select('id, domain_primary'),
  ]);

  for (const r of [
    clientResult,
    leadsResult,
    bookingsResult,
    reviewsResult,
    completionsResult,
    websiteResult,
  ]) {
    if (r.error) throw normalizeError(r.error);
  }

  const website =
    (websiteResult.data as { id: string; domain_primary: string }[])[0] ?? null;
  // Tracked analytics — fetched only when a website exists. The helpers
  // swallow their own errors, so a missing rollup never breaks the dashboard.
  const [funnelTotals, pageTotals] = website
    ? await Promise.all([
        fetchSurfaceFunnelTotals(website.id),
        fetchSurfacePageTotals(website.id),
      ])
    : [null, null];

  const join: ClientDashboardJoin = {
    client: (clientResult.data as { name: string; slug: string }[])[0] ?? null,
    leads: (leadsResult.data ?? []) as unknown as LeadRow[],
    bookings: (bookingsResult.data ?? []) as unknown as BookingRow[],
    reviews: (reviewsResult.data ?? []) as unknown as ReviewRow[],
    completions: (completionsResult.data ?? []) as CompletionRow[],
    websiteDomain: website?.domain_primary ?? null,
    ownerName: userResult.data?.display_name ?? 'there',
    funnelTotals,
    pageTotals,
  };

  return composeClientDashboard(join);
}

function composeClientDashboard(join: ClientDashboardJoin): ClientDashboard {
  const now = new Date();
  const nowMs = now.getTime();
  const { leads, bookings, reviews, completions } = join;

  // --- Urgent hero: leads still `new` (un-actioned). ------------------------
  const newLeads = [...leads]
    .filter((l) => l.status === 'new')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const oldestNewAge = newLeads.length
    ? nowMs - ms(newLeads[newLeads.length - 1].created_at)
    : 0;
  const callouts: DashboardCallout[] = newLeads.slice(0, 2).map((l) => ({
    name: l.customer_name_snapshot,
    age: relativeTime(l.created_at),
    note: [l.customer?.suburb, l.source]
      .filter(Boolean)
      .join(' · ') || 'New funnel enquiry',
  }));

  // --- Follow-up queue: leads not yet booked / completed / lost. -----------
  const followUpLeads = [...leads]
    .filter((l) => l.status === 'new' || l.status === 'contacted')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);
  const followUpItems: DashboardQueueItem[] = followUpLeads.map((l) => ({
    id: l.id,
    initial: initials(l.customer_name_snapshot),
    title: `${l.customer_name_snapshot}${
      l.customer?.suburb ? ` · ${l.customer.suburb}` : ''
    }`,
    sub: l.status === 'new' ? 'awaiting first contact' : 'awaiting follow-up',
    ...(l.status === 'new'
      ? { tag: { label: 'New', tone: 'urgent' as const } }
      : {}),
    time: relativeTime(l.created_at),
    href: `/leads/${l.id}`,
  }));

  // --- Today's jobs. -------------------------------------------------------
  const todays = [...bookings]
    .filter((b) => isToday(b.starts_at, now) && b.status !== 'cancelled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const nextJobIdx = todays.findIndex((b) => b.status !== 'completed');
  const todaysJobItems: DashboardQueueItem[] = todays.map((b, idx) => {
    const item: DashboardQueueItem = {
      id: b.id,
      initial:
        b.status === 'completed'
          ? '✓'
          : idx === nextJobIdx
            ? '→'
            : initials(b.customer_name_snapshot),
      title: b.title,
      sub: [
        `${clockLabel(b.starts_at)} — ${clockLabel(b.ends_at)}`,
        b.customer?.suburb,
        b.price != null ? money(b.price) : null,
      ]
        .filter(Boolean)
        .join(' · '),
      time: clockLabel(b.starts_at),
      href: `/bookings/${b.id}`,
    };
    if (b.status === 'completed') {
      item.avatarTone = 'good';
      item.tag = { label: 'Done', tone: 'done' };
    } else if (idx === nextJobIdx) {
      item.avatarTone = 'rust';
      item.tag = { label: 'Next up', tone: 'next' };
    }
    return item;
  });

  // --- Weekly stats. -------------------------------------------------------
  const leadTimes = leads.map((l) => ms(l.created_at));
  const bookingTimes = bookings.map((b) => ms(b.created_at));
  const reviewTimes = reviews.map((r) => ms(r.reviewed_at));
  const revenueRows = completions.map((c) => ({
    t: ms(c.completed_at),
    v: c.amount_charged ?? 0,
  }));

  const leadsWk = countInWeek(leadTimes, 0, nowMs);
  const bookingsWk = countInWeek(bookingTimes, 0, nowMs);
  const reviewsWk = countInWeek(reviewTimes, 0, nowMs);
  const revenueWk = sumInWeek(revenueRows, 0, nowMs);
  const revenuePrior = sumInWeek(revenueRows, 1, nowMs);

  const weeklyStats: HubWeeklyStat[] = [
    {
      kind: 'new-leads',
      label: '// NEW LEADS',
      value: String(leadsWk),
      delta: deltaLabel(leadsWk, countInWeek(leadTimes, 1, nowMs)),
      trend: weeklyCounts(leadTimes, nowMs),
    },
    {
      kind: 'bookings',
      label: '// BOOKINGS',
      value: String(bookingsWk),
      delta: deltaLabel(bookingsWk, countInWeek(bookingTimes, 1, nowMs)),
      trend: weeklyCounts(bookingTimes, nowMs),
    },
    {
      kind: 'revenue',
      label: '// REVENUE',
      value: money(revenueWk),
      delta:
        revenueWk > revenuePrior
          ? { direction: 'up', label: `${money(revenueWk - revenuePrior)} vs last wk` }
          : revenueWk < revenuePrior
            ? { direction: 'down', label: `${money(revenuePrior - revenueWk)} vs last wk` }
            : { direction: 'flat', label: 'level vs last wk' },
      trend: [3, 2, 1, 0].map((w) => sumInWeek(revenueRows, w, nowMs)),
    },
    {
      kind: 'reviews',
      label: '// 5★ REVIEWS',
      value: String(reviewsWk),
      delta: deltaLabel(reviewsWk, countInWeek(reviewTimes, 1, nowMs)),
      trend: weeklyCounts(reviewTimes, nowMs),
    },
  ];

  // --- Funnel + summary. ---------------------------------------------------
  const domain =
    join.websiteDomain ?? (join.client ? `${join.client.slug}.com.au` : '');
  const funnel = conversionFunnel(
    domain,
    now,
    leadsWk,
    bookingsWk,
    reviewsWk,
    join.funnelTotals,
  );
  const dropToBooked = Math.max(0, leadsWk - bookingsWk);
  const bookRate =
    leadsWk > 0 ? Math.round((bookingsWk / leadsWk) * 100) : 0;

  return {
    greeting: { tag: greetingTag(now), ownerName: firstName(join.ownerName) },
    urgentHero: {
      count: newLeads.length,
      threshold: oldestNewAge > 2 * 60 * 60 * 1000 ? 'overdue' : 'due-today',
      label:
        newLeads.length === 1
          ? 'new lead to call back'
          : 'new leads to call back',
      callouts,
      cta: { label: 'Open inbox →', href: '/leads' },
    },
    followUps: {
      heading: 'Follow-ups due',
      count: followUpItems.length,
      link: { label: 'All leads →', href: '/leads' },
      items: followUpItems,
    },
    todaysJobs: {
      heading: "Today's jobs",
      count: todaysJobItems.length,
      link: { label: 'Full week →', href: '/calendar' },
      items: todaysJobItems,
    },
    weeklyStats,
    weeklyMeta: `THIS WEEK · ${weekRangeLabel(now)}`,
    funnel,
    funnelSummary: {
      weakPoint: {
        fromLabel: 'New leads',
        toLabel: 'booked',
        dropCount: dropToBooked,
      },
      operatorNote:
        bookRate >= 50
          ? 'Your callback speed is keeping conversion strong.'
          : 'Faster callbacks lift the lead-to-booked rate — Webnua is on it.',
      healthNote:
        leadsWk > 0
          ? `Lead-to-booked is running at ${bookRate}% this week.`
          : 'No new leads yet this week.',
      cta: { label: 'View full analytics →', href: '/funnels' },
    },
    landingSnapshot: landingSnapshot(
      domain,
      join.websiteDomain != null,
      join.pageTotals,
      leadsWk,
    ),
    recentActivity: activityFeed(leads, reviews, 6),
  };
}

/** The landing-page snapshot card. The domain + live status come from the
 *  `websites` row; the four traffic stats are visitor-tracking rollups
 *  (visitor-tracking-design §7). Before a surface has tracked traffic the
 *  stats fall back to honest `—` placeholders. */
function landingSnapshot(
  domain: string,
  hasWebsite: boolean,
  pageTotals: SurfacePageTotals | null,
  leadCount: number,
): LandingSnapshot {
  const placeholder = (label: string): LandingSnapshotStat => ({
    label,
    value: '—',
    trend: 'Awaiting analytics',
    trendTone: 'quiet',
  });

  let stats: LandingSnapshot['stats'];
  if (pageTotals?.hasData) {
    const speed = pageSpeedScore(
      pageTotals.lcpP75,
      pageTotals.clsP75,
      pageTotals.inpP75,
    );
    const convRate =
      pageTotals.visits > 0
        ? Math.round((leadCount / pageTotals.visits) * 1000) / 10
        : null;
    stats = [
      {
        label: '// VISITS · 7D',
        value: String(pageTotals.visits),
        trend: `${pageTotals.uniqueVisitors} unique`,
        trendTone: 'good',
      },
      convRate === null
        ? placeholder('// CONV. RATE')
        : {
            label: '// CONV. RATE',
            value: `${convRate}%`,
            trend: 'Visits → leads',
            trendTone: 'good',
          },
      pageTotals.avgSeconds === null
        ? placeholder('// AVG TIME')
        : {
            label: '// AVG TIME',
            value: formatDwell(pageTotals.avgSeconds),
            trend: 'Time on page',
            trendTone: 'good',
          },
      speed === null
        ? placeholder('// PAGE SPEED')
        : {
            label: '// PAGE SPEED',
            value: String(speed),
            trend: speed >= 90 ? 'Fast' : speed >= 50 ? 'Moderate' : 'Needs work',
            trendTone: speed >= 50 ? 'good' : 'quiet',
          },
    ];
  } else {
    stats = [
      placeholder('// VISITS · 7D'),
      placeholder('// CONV. RATE'),
      placeholder('// AVG TIME'),
      placeholder('// PAGE SPEED'),
    ];
  }

  return {
    domain: domain || 'No website yet',
    meta: hasWebsite ? 'Live' : 'Not published yet',
    stats,
  };
}

/** The client dashboard — RLS bounds every read to the signed-in client. */
export function useClientDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'client'],
    queryFn: fetchClientDashboard,
  });
}

// =============================================================================
// Single-client overview hub — admin sub-account mode (Screen 20). Keyed to
// the active sub-account `clientId`; RLS already bounds the operator to their
// accessible clients, the `clientId` filter narrows to the drilled-in one.
// =============================================================================

type HubJoin = {
  clientName: string;
  clientSlug: string;
  industry: string | null;
  serviceArea: string | null;
  lifecycle: string;
  createdAt: string;
  leads: LeadRow[];
  bookings: BookingRow[];
  reviews: ReviewRow[];
  completions: CompletionRow[];
  websiteDomain: string | null;
  automationsTotal: number;
  automationsEnabled: number;
  campaign: { name: string; status: string; budget: number | null } | null;
  operatorName: string;
  /** Tracked top-of-funnel totals for the client's website (visitor-tracking
   *  §7). null when the client has no website. */
  funnelTotals: SurfaceFunnelTotals | null;
};

const HUB_OPERATOR_ACTIONS: OperatorAction[] = [
  { kind: 'edit-page', icon: '▤', label: 'Edit page', href: '/website' },
  {
    kind: 'manage-automations',
    icon: '⤿',
    label: 'Manage automations',
    href: '/automations',
  },
  { kind: 'edit-campaign', icon: '↗', label: 'Edit ad campaign', href: '/campaigns' },
  { kind: 'billing', icon: '$', label: 'Billing', href: '/settings/billing' },
  { kind: 'impersonate', icon: '⌥', label: 'Impersonate as client' },
];

async function fetchClientHub(clientSlug: string): Promise<ClientHub> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  // The workspace context carries the client `slug` (not the UUID), so the
  // client row is resolved first; the by-slug `.single()` resolves as
  // not_found for a client outside the operator's accessible set (RLS-hidden,
  // design §8).
  const clientResult = await supabase
    .from('clients')
    .select(
      'id, name, slug, industry, service_area, lifecycle_status, created_at',
    )
    .eq('slug', clientSlug)
    .single();
  if (clientResult.error) throw normalizeError(clientResult.error);
  const clientId = (clientResult.data as { id: string }).id;

  const [
    userResult,
    leadsResult,
    bookingsResult,
    reviewsResult,
    completionsResult,
    websiteResult,
    automationsResult,
    campaignsResult,
  ] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', user.id).single(),
    supabase.from('leads').select(LEAD_SELECT).eq('client_id', clientId),
    supabase.from('bookings').select(BOOKING_SELECT).eq('client_id', clientId),
    supabase.from('reviews').select(REVIEW_SELECT).eq('client_id', clientId),
    supabase
      .from('job_completions')
      .select('amount_charged, completed_at, booking:bookings!inner(client_id)')
      .eq('booking.client_id', clientId),
    supabase
      .from('websites')
      .select('id, domain_primary')
      .eq('client_id', clientId),
    supabase.from('automations').select('enabled').eq('client_id', clientId),
    supabase
      .from('campaigns')
      .select('name, status, budget')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
  ]);

  for (const r of [
    leadsResult,
    bookingsResult,
    reviewsResult,
    completionsResult,
    websiteResult,
    automationsResult,
    campaignsResult,
  ]) {
    if (r.error) throw normalizeError(r.error);
  }

  const client = clientResult.data as {
    name: string;
    slug: string;
    industry: string | null;
    service_area: string | null;
    lifecycle_status: string;
    created_at: string;
  };
  const automations = (automationsResult.data ?? []) as { enabled: boolean }[];
  const hubWebsite =
    (websiteResult.data as { id: string; domain_primary: string }[])[0] ?? null;
  const funnelTotals = hubWebsite
    ? await fetchSurfaceFunnelTotals(hubWebsite.id)
    : null;

  const join: HubJoin = {
    clientName: client.name,
    clientSlug: client.slug,
    industry: client.industry,
    serviceArea: client.service_area,
    lifecycle: client.lifecycle_status,
    createdAt: client.created_at,
    leads: (leadsResult.data ?? []) as unknown as LeadRow[],
    bookings: (bookingsResult.data ?? []) as unknown as BookingRow[],
    reviews: (reviewsResult.data ?? []) as unknown as ReviewRow[],
    completions: (completionsResult.data ?? []) as unknown as CompletionRow[],
    websiteDomain: hubWebsite?.domain_primary ?? null,
    funnelTotals,
    automationsTotal: automations.length,
    automationsEnabled: automations.filter((a) => a.enabled).length,
    campaign:
      (campaignsResult.data as {
        name: string;
        status: string;
        budget: number | null;
      }[])[0] ?? null,
    operatorName: userResult.data?.display_name ?? 'your operator',
  };

  return composeClientHub(clientId, join);
}

function composeClientHub(clientId: string, join: HubJoin): ClientHub {
  const now = new Date();
  const nowMs = now.getTime();
  const { leads, bookings, reviews, completions } = join;

  const liveDayCount = Math.max(
    0,
    Math.floor((nowMs - ms(join.createdAt)) / DAY),
  );

  const leadTimes = leads.map((l) => ms(l.created_at));
  const bookingTimes = bookings.map((b) => ms(b.created_at));
  const reviewTimes = reviews.map((r) => ms(r.reviewed_at));
  const revenueRows = completions.map((c) => ({
    t: ms(c.completed_at),
    v: c.amount_charged ?? 0,
  }));

  const leadsWk = countInWeek(leadTimes, 0, nowMs);
  const bookingsWk = countInWeek(bookingTimes, 0, nowMs);
  const reviewsWk = countInWeek(reviewTimes, 0, nowMs);
  const revenueWk = sumInWeek(revenueRows, 0, nowMs);
  const revenuePrior = sumInWeek(revenueRows, 1, nowMs);

  // Lead-focal breakdown by status.
  const recentLeads = leads.filter((l) => ms(l.created_at) >= nowMs - WEEK);
  const booked = recentLeads.filter(
    (l) => l.status === 'booked' || l.status === 'completed',
  ).length;
  const pendingCallback = recentLeads.filter(
    (l) => l.status === 'new' || l.status === 'contacted',
  ).length;
  const ghosted = recentLeads.filter((l) => l.status === 'lost').length;

  const domain =
    join.websiteDomain ?? `${join.clientSlug}.com.au`;

  // Hero stat strip. booked + revenue are real; ad-spend is the campaign
  // budget; ROAS has no metrics table → honest placeholder (design §5 #14).
  const stats: HubHeroStat[] = [
    {
      kind: 'booked-7d',
      label: 'BOOKED 7D',
      value: String(bookingsWk),
      caption: deltaLabel(bookingsWk, countInWeek(bookingTimes, 1, nowMs))
        .label,
      captionTone: bookingsWk >= countInWeek(bookingTimes, 1, nowMs)
        ? 'good'
        : 'quiet',
    },
    {
      kind: 'revenue-7d',
      label: 'REVENUE 7D',
      value: money(revenueWk),
      caption:
        revenueWk >= revenuePrior ? 'up vs prev week' : 'down vs prev week',
      captionTone: revenueWk >= revenuePrior ? 'good' : 'quiet',
    },
    {
      kind: 'ad-spend',
      label: 'AD SPEND',
      value: join.campaign?.budget != null ? money(join.campaign.budget) : '—',
      caption:
        join.campaign?.budget != null
          ? `${money(join.campaign.budget / 7)}/day · budget`
          : 'No campaign budget set',
      captionTone: 'quiet',
    },
    {
      kind: 'roas',
      label: 'ROAS',
      value: '—',
      caption: 'Awaiting Meta Ads',
      captionTone: 'quiet',
    },
  ];

  const contextCards: HubContextCard[] = [
    {
      kind: 'landing-page',
      label: '// LANDING PAGE',
      headline: join.websiteDomain ? domain : 'No website yet',
      facts: join.websiteDomain
        ? ['Published', 'Traffic metrics awaiting analytics']
        : ['Website not published yet'],
      link: { label: 'Open editor →', href: '/website' },
    },
    {
      kind: 'automations',
      label: '// AUTOMATIONS',
      headline: `${join.automationsEnabled} of ${join.automationsTotal} active`,
      facts: [
        `${join.automationsTotal} ${
          join.automationsTotal === 1 ? 'flow' : 'flows'
        } configured`,
        'Send counts awaiting messaging log',
      ],
      link: { label: 'Manage flows →', href: '/automations' },
    },
    {
      kind: 'campaign',
      label: '// META AD CAMPAIGN',
      headline: join.campaign
        ? `${join.campaign.name} · ${join.campaign.status}`
        : 'No campaign yet',
      facts: join.campaign
        ? [
            join.campaign.budget != null
              ? `${money(join.campaign.budget)} budget`
              : 'No budget set',
            'CPL / ROAS awaiting Meta Ads',
          ]
        : ['No Meta Ads campaign configured'],
      link: { label: 'View campaign →', href: '/campaigns' },
    },
  ];

  const weeklyStats: HubWeeklyStat[] = [
    {
      kind: 'new-leads',
      label: '// NEW LEADS',
      value: String(leadsWk),
      delta: deltaLabel(leadsWk, countInWeek(leadTimes, 1, nowMs)),
      trend: weeklyCounts(leadTimes, nowMs),
    },
    {
      kind: 'bookings',
      label: '// BOOKINGS',
      value: String(bookingsWk),
      delta: deltaLabel(bookingsWk, countInWeek(bookingTimes, 1, nowMs)),
      trend: weeklyCounts(bookingTimes, nowMs),
    },
    {
      kind: 'revenue',
      label: '// REVENUE',
      value: money(revenueWk),
      delta:
        revenueWk > revenuePrior
          ? { direction: 'up', label: `${money(revenueWk - revenuePrior)} vs last wk` }
          : revenueWk < revenuePrior
            ? { direction: 'down', label: `${money(revenuePrior - revenueWk)} vs last wk` }
            : { direction: 'flat', label: 'level vs last wk' },
      trend: [3, 2, 1, 0].map((w) => sumInWeek(revenueRows, w, nowMs)),
    },
    {
      kind: 'reviews',
      label: '// 5★ REVIEWS',
      value: String(reviewsWk),
      delta: deltaLabel(reviewsWk, countInWeek(reviewTimes, 1, nowMs)),
      trend: weeklyCounts(reviewTimes, nowMs),
    },
  ];

  const bookRate = leadsWk > 0 ? Math.round((bookingsWk / leadsWk) * 100) : 0;

  return {
    clientId,
    operatorActions: HUB_OPERATOR_ACTIONS,
    hero: {
      clientName: join.clientName,
      lifecycle: join.lifecycle === 'onboarding' ? 'onboarding' : 'live',
      liveDayCount,
      identityFacts: [
        join.industry ?? 'Service business',
        join.serviceArea ?? 'Service area not set',
        join.campaign?.budget != null
          ? `${money(join.campaign.budget)} ad budget`
          : 'No ad budget',
      ],
      managementState: {
        primary: 'operator',
        clientLastActiveDays: 0,
        operatorName: firstName(join.operatorName),
      },
      leadFocal: {
        count: leadsWk,
        label: leadsWk === 1 ? 'lead this week' : 'leads this week',
        breakdown: { booked, pendingCallback, ghosted },
        cta: { label: 'Open lead inbox →', href: '/leads' },
      },
      stats,
    },
    contextCards,
    schedule: todayPanel(
      bookings,
      now,
      (join.clientName[0] ?? '?').toUpperCase(),
      'freshhome',
    ),
    recentActivity: activityFeed(leads, reviews, 6),
    weeklyStats,
    funnel: conversionFunnel(
      domain,
      now,
      leadsWk,
      bookingsWk,
      reviewsWk,
      join.funnelTotals,
    ),
    insight: {
      severity:
        leadsWk === 0 ? 'warn' : bookRate >= 50 ? 'good' : 'opportunity',
      target: 'lead-to-booked',
      suggestedAction:
        'review callback speed to lift the lead-to-booked rate',
      reasoning:
        leadsWk === 0
          ? 'no new leads landed this week — the funnel needs traffic before conversion can be read.'
          : `${bookingsWk} of ${leadsWk} leads booked this week (${bookRate}%).`,
    },
  };
}

/** The single-client overview hub — keyed to the active sub-account client
 *  `slug` (the workspace context carries the slug, not the UUID). RLS bounds
 *  the operator to accessible clients; the by-slug `.single()` resolves as
 *  not_found for a client outside that set. */
export function useClientHub(clientSlug: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'hub', clientSlug],
    queryFn: () => fetchClientHub(clientSlug as string),
    enabled: clientSlug != null && clientSlug.length > 0,
  });
}

// =============================================================================
// Agency dashboard — operator agency-mode central overview. A triage surface:
// the most pressing cross-client signals first (urgent banner + attention
// panels), then per-client performance. RLS bounds every read to the
// operator's accessible clients.
//
// SCHEMA GAP — billing. MRR, churn, and cashflow (failed payments) have no
// table (no Stripe integration yet); they render honest "Awaiting billing
// integration" placeholders, the same pattern ROAS / page-speed use.
// =============================================================================

export type AdminDashboardData = {
  greeting: {
    tag: string;
    word: string;
    operatorName: string;
    subtitle: string;
  };
  urgent: AgencyUrgent | null;
  panels: {
    cashflow: AttentionPanelData;
    onboarding: AttentionPanelData;
    support: AttentionPanelData;
  };
  stats: DashboardStat[];
  clientPerformance: ClientPerformanceCardData[];
  recentActivity: ActivityRowData[];
};

type AdminClientRow = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  service_area: string | null;
  lifecycle_status: string;
  created_at: string;
};

type AdminLeadRow = {
  id: string;
  client_id: string;
  created_at: string;
  customer_name_snapshot: string;
  customer: { suburb: string | null } | null;
};

type AdminBookingRow = { client_id: string; status: string; created_at: string };

type AdminReviewRow = {
  id: string;
  client_id: string;
  author_name: string;
  stars: number;
  reviewed_at: string;
};

type AdminTicketRow = {
  id: string;
  reference: string;
  client_id: string;
  title: string;
  status: string;
  urgency: string;
  created_at: string;
};

type AdminJoin = {
  operatorName: string;
  clients: AdminClientRow[];
  leads: AdminLeadRow[];
  bookings: AdminBookingRow[];
  campaigns: { client_id: string; budget: number | null }[];
  reviews: AdminReviewRow[];
  tickets: AdminTicketRow[];
};

async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const [
    userResult,
    clientsResult,
    leadsResult,
    bookingsResult,
    campaignsResult,
    reviewsResult,
    ticketsResult,
  ] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', user.id).single(),
    supabase
      .from('clients')
      .select(
        'id, name, slug, industry, service_area, lifecycle_status, created_at',
      )
      .order('name'),
    supabase
      .from('leads')
      .select(
        'id, client_id, created_at, customer_name_snapshot, ' +
          'customer:customers(suburb)',
      ),
    supabase.from('bookings').select('client_id, status, created_at'),
    supabase.from('campaigns').select('client_id, budget'),
    supabase
      .from('reviews')
      .select('id, client_id, author_name, stars, reviewed_at'),
    supabase
      .from('tickets')
      .select('id, reference, client_id, title, status, urgency, created_at'),
  ]);

  for (const r of [
    clientsResult,
    leadsResult,
    bookingsResult,
    campaignsResult,
    reviewsResult,
    ticketsResult,
  ]) {
    if (r.error) throw normalizeError(r.error);
  }

  return composeAdminDashboard({
    operatorName: userResult.data?.display_name ?? 'there',
    clients: (clientsResult.data ?? []) as unknown as AdminClientRow[],
    leads: (leadsResult.data ?? []) as unknown as AdminLeadRow[],
    bookings: (bookingsResult.data ?? []) as unknown as AdminBookingRow[],
    campaigns: (campaignsResult.data ?? []) as {
      client_id: string;
      budget: number | null;
    }[],
    reviews: (reviewsResult.data ?? []) as unknown as AdminReviewRow[],
    tickets: (ticketsResult.data ?? []) as unknown as AdminTicketRow[],
  });
}

function composeAdminDashboard(join: AdminJoin): AdminDashboardData {
  const now = new Date();
  const nowMs = now.getTime();
  const { clients, leads, bookings, campaigns, reviews, tickets } = join;

  const nameOf = (id: string): string =>
    clients.find((c) => c.id === id)?.name ?? 'A client';
  const initialOf = (id: string): string => (nameOf(id)[0] ?? '?').toUpperCase();

  const liveClients = clients.filter((c) => c.lifecycle_status === 'live');
  const onboardingClients = clients.filter(
    (c) => c.lifecycle_status === 'onboarding',
  );

  // --- Open tickets + low reviews — the cross-client risk signals. ---------
  const openTickets = tickets
    .filter((t) => t.status === 'open' || t.status === 'in_progress')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lowReviews = reviews
    .filter((r) => r.stars <= 2 && ms(r.reviewed_at) >= nowMs - 14 * DAY)
    .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));

  // --- Urgent banner — the single most pressing signal. --------------------
  let urgent: AgencyUrgent | null = null;
  const topLowReview = lowReviews[0];
  const rushTicket = openTickets
    .filter((t) => t.urgency === 'rush')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (topLowReview) {
    const clientName = nameOf(topLowReview.client_id);
    urgent = {
      tag: '// 1 urgent · needs you now',
      title: (
        <>
          {clientName} · <em>{topLowReview.stars}★ review</em> needs a reply
        </>
      ),
      description: (
        <>
          <strong>{topLowReview.author_name}</strong> left a{' '}
          {topLowReview.stars}-star review {relativeTime(topLowReview.reviewed_at)}.
          A fast, considered reply limits the hit to {clientName}&rsquo;s rating.
        </>
      ),
      cta: { label: 'Open reviews →', href: '/reviews' },
    };
  } else if (rushTicket) {
    const clientName = nameOf(rushTicket.client_id);
    urgent = {
      tag: '// 1 urgent · needs you now',
      title: (
        <>
          {clientName} · <em>{rushTicket.title}</em>
        </>
      ),
      description: (
        <>
          A rush-priority ticket has been open since{' '}
          {relativeTime(rushTicket.created_at)}. <strong>{clientName}</strong> is
          waiting on your response.
        </>
      ),
      cta: { label: 'Open ticket →', href: `/tickets/${rushTicket.reference}` },
    };
  }

  // --- Attention panels ----------------------------------------------------
  const cashflow: AttentionPanelData = {
    heading: 'Cashflow attention',
    count: null,
    rows: [],
    placeholder: '// Awaiting billing integration',
  };

  const onboarding: AttentionPanelData = {
    heading: 'Onboarding tasks',
    count: onboardingClients.length,
    rows: onboardingClients.map((c) => ({
      id: c.id,
      initial: (c.name[0] ?? '?').toUpperCase(),
      title: c.name,
      meta: `Setup started ${relativeTime(c.created_at)}`,
      metaTone: 'rust' as const,
    })),
  };

  const support: AttentionPanelData = {
    heading: 'Client support',
    count: openTickets.length,
    link: { label: 'All →', href: '/tickets' },
    rows: openTickets.slice(0, 5).map((t) => ({
      id: t.id,
      initial: initialOf(t.client_id),
      title: t.title,
      meta: `${nameOf(t.client_id)} · ${relativeTime(t.created_at)}`,
      metaTone: t.urgency === 'rush' ? ('rust' as const) : ('quiet' as const),
      href: `/tickets/${t.reference}`,
    })),
  };

  // --- Stat row. MRR + churn are billing-integration placeholders. ---------
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const stats: DashboardStat[] = [
    {
      label: '// MRR',
      value: '—',
      trend: 'Awaiting billing integration',
      trendTone: 'quiet',
    },
    {
      label: '// Active clients',
      value: <em>{liveClients.length}</em>,
      trend: `${liveClients.length} live · ${onboardingClients.length} onboarding`,
      trendTone: 'good',
    },
    {
      label: '// Churn · 90d',
      value: '—',
      trend: 'Awaiting billing integration',
      trendTone: 'quiet',
    },
    {
      label: '// Client ad spend',
      value: money(totalBudget),
      trend: `across ${campaigns.length} ${
        campaigns.length === 1 ? 'campaign' : 'campaigns'
      }`,
      trendTone: 'quiet',
    },
  ];

  // --- Per-client performance cards. ---------------------------------------
  const leads7dFor = (id: string): number =>
    countInWeek(
      leads.filter((l) => l.client_id === id).map((l) => ms(l.created_at)),
      0,
      nowMs,
    );
  const booked7dFor = (id: string): number =>
    bookings.filter(
      (b) =>
        b.client_id === id &&
        b.status !== 'cancelled' &&
        ms(b.created_at) >= nowMs - WEEK,
    ).length;
  const budgetFor = (id: string): number =>
    campaigns
      .filter((c) => c.client_id === id)
      .reduce((s, c) => s + (c.budget ?? 0), 0);

  const clientPerformance: ClientPerformanceCardData[] = clients.map((c) => {
    const liveDays = Math.max(0, Math.floor((nowMs - ms(c.created_at)) / DAY));
    const isOnboarding = c.lifecycle_status === 'onboarding';
    const leads7d = leads7dFor(c.id);
    const booked7d = booked7dFor(c.id);
    const budget = budgetFor(c.id);
    const openTk = openTickets.filter((t) => t.client_id === c.id).length;
    const lowRev = lowReviews.filter(
      (r) => r.client_id === c.id && ms(r.reviewed_at) >= nowMs - WEEK,
    ).length;
    const atRisk = !isOnboarding && (openTk > 0 || lowRev > 0);

    let rank: number;
    let statusLabel: string;
    let statusTone: AgencyTone;
    let note: string;
    if (isOnboarding) {
      rank = 2;
      statusLabel = 'Onboarding';
      statusTone = 'quiet';
      note = 'In setup — not launched yet';
    } else if (atRisk) {
      rank = 0;
      statusLabel = 'At risk';
      statusTone = 'rust';
      const reasons: string[] = [];
      if (lowRev > 0)
        reasons.push(`${lowRev} low review${lowRev === 1 ? '' : 's'} this week`);
      if (openTk > 0)
        reasons.push(`${openTk} open ticket${openTk === 1 ? '' : 's'}`);
      note = reasons.join(' · ');
    } else {
      rank = 1;
      statusLabel = 'Healthy';
      statusTone = 'good';
      note =
        leads7d > 0
          ? `${leads7d} new lead${leads7d === 1 ? '' : 's'} this week`
          : 'Quiet week — no new leads';
    }

    return {
      slug: c.slug,
      initial: (c.name[0] ?? '?').toUpperCase(),
      name: c.name,
      meta: [isOnboarding ? 'In setup' : `Day ${liveDays}`, c.industry]
        .filter(Boolean)
        .join(' · '),
      leads7d: isOnboarding ? null : leads7d,
      booked7d: isOnboarding ? null : booked7d,
      spend: budget > 0 ? money(budget) : '—',
      statusLabel,
      statusTone,
      note,
      rank,
    };
  });
  clientPerformance.sort(
    (a, b) => a.rank - b.rank || (b.leads7d ?? -1) - (a.leads7d ?? -1),
  );

  // --- Recent activity — cross-client leads + reviews, newest first. -------
  const activityEvents: { at: number; row: ActivityRowData }[] = [];
  for (const r of reviews) {
    activityEvents.push({
      at: ms(r.reviewed_at),
      row: {
        id: `act-review-${r.id}`,
        icon: '★',
        tone: 'amber',
        actor: nameOf(r.client_id),
        body: `· ${r.author_name} left a ${r.stars}★ review`,
        time: relativeTime(r.reviewed_at),
        href: '/reviews',
      },
    });
  }
  for (const l of leads) {
    activityEvents.push({
      at: ms(l.created_at),
      row: {
        id: `act-lead-${l.id}`,
        icon: '✉',
        tone: 'info',
        actor: nameOf(l.client_id),
        body: `· new lead — ${l.customer_name_snapshot}${
          l.customer?.suburb ? ` · ${l.customer.suburb}` : ''
        }`,
        time: relativeTime(l.created_at),
        href: `/leads/${l.id}`,
      },
    });
  }
  const recentActivity = activityEvents
    .sort((a, b) => b.at - a.at)
    .slice(0, 8)
    .map((e) => e.row);

  // --- Greeting ------------------------------------------------------------
  const leadsThisWeek = countInWeek(
    leads.map((l) => ms(l.created_at)),
    0,
    nowMs,
  );
  const subtitle =
    onboardingClients.length > 0
      ? `${liveClients.length} client${
          liveClients.length === 1 ? '' : 's'
        } live, ${onboardingClients.length} mid-setup — ${leadsThisWeek} new lead${
          leadsThisWeek === 1 ? '' : 's'
        } this week.`
      : `All ${liveClients.length} client${
          liveClients.length === 1 ? '' : 's'
        } live — ${leadsThisWeek} new lead${
          leadsThisWeek === 1 ? '' : 's'
        } this week.`;

  return {
    greeting: {
      tag: greetingTag(now),
      word: greetingWord(now),
      operatorName: firstName(join.operatorName),
      subtitle,
    },
    urgent,
    panels: { cashflow, onboarding, support },
    stats,
    clientPerformance,
    recentActivity,
  };
}

/** The operator agency-mode cross-client roster — RLS bounds rows to the
 *  operator's accessible clients. */
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: fetchAdminDashboard,
  });
}
