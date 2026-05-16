// =============================================================================
// Single-client overview hub — typed schema (admin Screen 20).
//
// Vision §7: the hub is the platform's densest operator-context surface, so
// this shape is the de-facto schema the backend inherits. Discipline applied
// here — every field maps to a column or a computed / templated value. Nothing
// needs an LLM to populate. Editorial flourish from the prototype copy ("best
// week since launch", etc.) is deliberately dropped, not smuggled in as data.
// Where the prototype rendered a composed sentence (management state, the
// funnel insight), the parts are stored and the component composes.
// =============================================================================

import type { CalendarTodayPanel as CalendarTodayPanelData } from '@/lib/calendar/types';

// --- Operator actions bar ---------------------------------------------------

export type OperatorActionKind =
  | 'edit-page'
  | 'manage-automations'
  | 'edit-campaign'
  | 'billing'
  | 'impersonate';

/** One action in the operator-actions bar. Typed by `kind` — a discrete,
 *  attributable operator event — not by its prose label. */
export type OperatorAction = {
  kind: OperatorActionKind;
  icon: string;
  label: string;
  /** Navigation target; absent for actions wired later (e.g. impersonate). */
  href?: string;
};

// --- Management state -------------------------------------------------------

/** Who is actively driving this account. The hero renders the sentence from
 *  these parts — it is never stored as composed prose. */
export type ManagementState = {
  primary: 'operator' | 'client';
  clientLastActiveDays: number;
  operatorName: string;
};

// --- Hero -------------------------------------------------------------------

export type HubLifecycle = 'onboarding' | 'live';

/** A 7-day headline metric in the hero stat strip. */
export type HubHeroStat = {
  /** Stable key, e.g. 'booked-7d' | 'revenue-7d' | 'ad-spend' | 'roas'. */
  kind: string;
  label: string;
  value: string;
  /** Templated from structured values (delta, benchmark flag) — a fill. */
  caption: string;
  captionTone: 'good' | 'quiet';
};

export type HubLeadFocal = {
  count: number;
  label: string;
  breakdown: {
    booked: number;
    pendingCallback: number;
    ghosted: number;
  };
  cta: { label: string; href: string };
};

export type HubHero = {
  clientName: string;
  lifecycle: HubLifecycle;
  liveDayCount: number;
  /** Computed identity facts; each element a column template-fill. */
  identityFacts: string[];
  managementState: ManagementState;
  leadFocal: HubLeadFocal;
  stats: HubHeroStat[];
};

// --- Context cards ----------------------------------------------------------

export type HubContextCardKind = 'landing-page' | 'automations' | 'campaign';

export type HubContextCard = {
  kind: HubContextCardKind;
  /** Mono eyebrow, e.g. '// LANDING PAGE'. */
  label: string;
  headline: string;
  /** Computed facts, each element a column template-fill; the card renders
   *  them ·-joined. Not split into per-card typed field sets — the three
   *  cards have divergent fact shapes and a string-list of computed values
   *  satisfies the "no narrative interpretation" test. */
  facts: string[];
  link: { label: string; href: string };
};

// --- Recent activity --------------------------------------------------------

export type HubActivityKind = 'review' | 'lead' | 'auto-reply' | 'review-request';

/** A typed activity event. `_hub-content` maps `kind` → icon + tone for the
 *  shared `ActivityFeed`; the data stays presentation-free. */
export type HubActivityEvent = {
  id: string;
  kind: HubActivityKind;
  actor?: string;
  body: string;
  detail?: string;
  /** Computed relative label (backend: now − created_at). */
  time: string;
};

// --- Weekly stats (this week vs prior) --------------------------------------

export type HubWeeklyStat = {
  /** Stable key, e.g. 'new-leads' | 'bookings' | 'revenue' | 'reviews'. */
  kind: string;
  label: string;
  value: string;
  delta: { direction: 'up' | 'down' | 'flat'; label: string };
  /** 4-point series [3 weeks ago, 2 weeks ago, last week, now]. */
  trend: number[];
};

// --- Funnel conversion ------------------------------------------------------

export type HubFunnelStep = {
  /** Stable key, e.g. 'landing' | 'engaged' | 'form-started'. */
  kind: string;
  label: string;
  sublabel: string;
  count: number;
  /** Share of the top-of-funnel step, 0–100. */
  pct: number;
};

export type HubFunnelConversion = {
  domain: string;
  periodLabel: string;
  steps: HubFunnelStep[];
};

// --- Insight ----------------------------------------------------------------

export type FunnelInsightSeverity = 'good' | 'opportunity' | 'warn';

/** A structured funnel insight. The band renders prose from these parts;
 *  `reasoning` is a designated supporting-evidence slot, not a free blob. */
export type FunnelInsight = {
  severity: FunnelInsightSeverity;
  /** What the insight is about, e.g. 'booked-to-reviewed'. */
  target: string;
  /** The recommended action. */
  suggestedAction: string;
  /** Why — the supporting reasoning. */
  reasoning: string;
};

// --- Top-level --------------------------------------------------------------

export type ClientHub = {
  clientId: string;
  operatorActions: OperatorAction[];
  hero: HubHero;
  contextCards: HubContextCard[];
  /** Feeds the reused `CalendarTodayPanel`. */
  schedule: CalendarTodayPanelData;
  recentActivity: HubActivityEvent[];
  weeklyStats: HubWeeklyStat[];
  funnel: HubFunnelConversion;
  insight: FunnelInsight;
};
