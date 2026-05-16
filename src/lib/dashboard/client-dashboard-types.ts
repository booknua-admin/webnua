// =============================================================================
// Client dashboard — typed schema (client Screen 1).
//
// Same discipline as `hub-types.ts`: every field maps to a column or a
// computed / templated value — nothing needs an LLM to populate. Where the
// prototype rendered a composed sentence (the urgent-hero callouts, the funnel
// summary), the parts are stored and the component composes the prose.
//
// `HubWeeklyStat` and `HubFunnelConversion` are reused verbatim — the client
// "this week" trend and the funnel-performance bars are structurally identical
// to the hub's. Concepts that diverge structurally get their own types below.
// =============================================================================

import type { HubActivityEvent, HubFunnelConversion, HubWeeklyStat } from './hub-types';

// --- Urgent hero ------------------------------------------------------------

/** One named lead surfaced in the urgent hero. `note` is a column / template
 *  fill (the lead's latest status), not a narrative blob. */
export type DashboardCallout = {
  name: string;
  /** Computed relative age, e.g. '32 min ago'. */
  age: string;
  note: string;
};

export type UrgentThreshold = 'overdue' | 'due-today';

export type DashboardUrgentHero = {
  /** Leads needing a callback now. */
  count: number;
  threshold: UrgentThreshold;
  /** Templated fill, e.g. 'new leads to call back'. */
  label: string;
  /** The specific leads behind the count — the hero composes the sub-line. */
  callouts: DashboardCallout[];
  cta: { label: string; href: string };
};

// --- Queue cards (follow-ups due / today's jobs) ----------------------------

/** Inline status pill on a queue row. `tone` is a colour key, not a category. */
export type QueueItemTag = {
  label: string;
  tone: 'urgent' | 'done' | 'next';
};

export type DashboardQueueItem = {
  id: string;
  /** Avatar initials. */
  initial: string;
  /** Optional avatar fill — `good` for a completed job, `rust` for the next. */
  avatarTone?: 'good' | 'rust';
  title: string;
  /** Secondary line — time range, suburb, price; ·-joined at the source. */
  sub: string;
  tag?: QueueItemTag;
  /** Computed relative or clock time, e.g. '32m' / '10:00'. */
  time: string;
  /** When set the whole row is a link. */
  href?: string;
};

export type DashboardQueue = {
  heading: string;
  count: number;
  link: { label: string; href: string };
  items: DashboardQueueItem[];
};

// --- Landing-page snapshot --------------------------------------------------

export type LandingSnapshotStat = {
  /** Mono eyebrow, e.g. '// VISITS · 7D'. */
  label: string;
  value: string;
  trend: string;
  trendTone: 'good' | 'quiet';
};

export type LandingSnapshot = {
  domain: string;
  /** Computed status line, e.g. 'Live · v3 · last edited 2d ago'. */
  meta: string;
  stats: LandingSnapshotStat[];
};

// --- Funnel summary ---------------------------------------------------------

/** The client-framed funnel summary. The band composes plain prose from these
 *  parts — never a stored sentence (vision §7). Sibling of the operator-shaped
 *  `FunnelInsight`: the client framing is plainer and carries an operator-note
 *  slot rather than a structured severity / suggested-action pair. */
export type ClientFunnelSummary = {
  /** The weakest step transition — drives 'X → Y is your weak point'. */
  weakPoint: { fromLabel: string; toLabel: string; dropCount: number };
  /** Templated from an operator-task record — what Webnua is doing about it. */
  operatorNote: string;
  /** Templated from a computed ratio — the reassuring counter-balance. */
  healthNote: string;
  cta: { label: string; href: string };
};

// --- Top-level --------------------------------------------------------------

export type ClientDashboard = {
  greeting: {
    /** Mono eyebrow, e.g. '// Wednesday · 10:35 AM'. */
    tag: string;
    ownerName: string;
  };
  urgentHero: DashboardUrgentHero;
  followUps: DashboardQueue;
  todaysJobs: DashboardQueue;
  weeklyStats: HubWeeklyStat[];
  /** Mono meta for the trend block, e.g. 'DAY 14 OF LIVE · MAY 7–13'. */
  weeklyMeta: string;
  funnel: HubFunnelConversion;
  funnelSummary: ClientFunnelSummary;
  landingSnapshot: LandingSnapshot;
  recentActivity: HubActivityEvent[];
};
