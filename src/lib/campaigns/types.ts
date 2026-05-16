import type { ReactNode } from 'react';

/**
 * Activity-icon vocabulary on the client `/campaigns` activity log.
 * Each tone has its own background + glyph colour mapping.
 */
export type CampaignActivityIconTone =
  | 'creative'
  | 'audience'
  | 'budget'
  | 'tune';

/** Single tile inside the active-campaign hero metric grid. */
export type CampaignMetric = {
  label: string;
  /** ReactNode so `<em>` highlights rust on the value. */
  value: ReactNode;
  /** Sub line below the value. */
  trend?: ReactNode;
  /** Tints the trend line. `good`/`warn` colours match the prototype. */
  trendTone?: 'good' | 'warn' | 'quiet';
};

/** Top managed-by reassurance band on client `/campaigns`. */
export type CampaignManagedBandData = {
  icon: string;
  tag: string;
  /** ReactNode — `<em>` renders rust-light on ink. */
  title: ReactNode;
  /** ReactNode — `<strong>` renders paper-bold on ink. */
  sub: ReactNode;
  cta: { label: string; href: string };
};

/** Active campaign hero (Client Screen 18). */
export type CampaignHeroData = {
  eyebrow: string;
  /** ReactNode — `<em>` renders rust. */
  name: ReactNode;
  /** ReactNode — `<strong>` renders ink-bold. */
  meta: ReactNode;
  statusLabel: string;
  metrics: CampaignMetric[];
  plainEnglish: ReactNode;
};

/** One week column in the leads-vs-spend grouped bar chart. */
export type CampaignTrendWeek = {
  label: string;
  leads: number;
  spend: number;
  /** Highlights this column as the current week (rust glow + bold label). */
  current?: boolean;
};

export type CampaignTrendChartData = {
  title: ReactNode;
  sub: string;
  /** Y-axis tick labels, top-to-bottom. */
  yAxisLabels: string[];
  /** Max value used to scale both bar types. e.g. 20 leads / $300 spend → 20 + $300. */
  leadsMax: number;
  spendMax: number;
  weeks: CampaignTrendWeek[];
  legendLeadsLabel: string;
  legendSpendLabel: string;
};

/** Single row inside the client campaign activity log. */
export type CampaignActivityItem = {
  id: string;
  icon: string;
  tone: CampaignActivityIconTone;
  /** ReactNode — `<strong>` renders ink-bold; the "who" name is rendered
   *  in rust via a leading prop. */
  who: string;
  body: ReactNode;
  desc: string;
  time: string;
};

export type CampaignActivityData = {
  title: ReactNode;
  sub: ReactNode;
  items: CampaignActivityItem[];
};

/** Bottom "want to change something?" card on client `/campaigns`. */
export type CampaignChangeCardData = {
  /** ReactNode — `<strong>` renders ink-bold. */
  body: ReactNode;
  actions: { label: string; primary?: boolean }[];
};

/** Top-level client `/campaigns` stub. */
export type ClientCampaignsPage = {
  hero: { eyebrow: string; title: ReactNode; subtitle: ReactNode };
  managedBand: CampaignManagedBandData;
  active: CampaignHeroData;
  trend: CampaignTrendChartData;
  activity: CampaignActivityData;
  changeCard: CampaignChangeCardData;
};

/** Single row on the admin cross-client campaign roster. */
export type AdminCampaignStatus = 'active' | 'paused' | 'pending';

export type AdminCampaignRow = {
  id: string;
  /** The client this campaign belongs to — matches the filter-chip id. */
  clientId: string;
  logoInitial: string;
  /** Plain-text name, e.g. "FreshHome · $99 first clean". */
  name: string;
  /** ReactNode — `<strong>` renders ink-soft. */
  meta: ReactNode;
  status: AdminCampaignStatus;
  /** Defaults to "Active" / "Paused" / "Pending"; override per row. */
  statusLabel?: string;
  /** Each cell: large value (ReactNode for `<em>` rust) + small mono sub. */
  cells: { value: ReactNode; sub: string }[];
  /** Polyline points string for the sparkline. Null = dashed flatline. */
  sparkPoints?: string;
  /** Dims the whole row (e.g. Voltline pre-launch). */
  dimmed?: boolean;
};

export type AdminCampaignsPage = {
  hero: { eyebrow: string; title: ReactNode; subtitle: ReactNode };
  filters: { id: string; label: string; count?: number }[];
  defaultFilterId: string;
  stats: {
    label: string;
    value: ReactNode;
    trend?: ReactNode;
    trendTone?: 'good' | 'quiet';
  }[];
  rows: AdminCampaignRow[];
  /** Footer info bar at the bottom of the roster. */
  footer: {
    tag: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
  };
};
