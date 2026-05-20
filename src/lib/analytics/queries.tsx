// =============================================================================
// Visitor-engagement analytics — read layer.
//
// Reads the pre-aggregated rollup tables (analytics_funnel_daily /
// analytics_page_daily) the hourly aggregation job fills from the raw
// analytics_events stream. Implements visitor-tracking-design.md §7 — the
// data behind the dashboard's top-of-funnel bars and the landing-page
// snapshot. No new UI: the dashboard query layer composes these totals into
// the existing HubFunnelConversion / LandingSnapshot shapes.
//
// RESILIENCE: the fetch helpers SWALLOW errors and return empty totals rather
// than throwing. Analytics is a backfill of existing surfaces — if the rollup
// tables are unavailable (or empty before the first public traffic), the
// dashboard must still render, falling back to its honest placeholders.
// =============================================================================

import { supabase } from '@/lib/supabase/client';

/** The rollup window the dashboard surfaces read — last 7 days. */
export const ANALYTICS_WINDOW_DAYS = 7;

/** Tracked top-of-funnel totals for one surface over the window. Counts are
 *  unique-visitors-per-day summed — a directional, visit-based proxy. */
export type SurfaceFunnelTotals = {
  /** Page views — the top of the funnel. */
  landing: number;
  /** Visitors who scrolled past 50%. */
  engaged: number;
  /** Visitors who focused a form field. */
  formStarted: number;
  /** Visitors who submitted (analytics-audit §5.2 gap #1). "Submit attempted"
   *  semantics — the capture-phase listener fires before the API result is
   *  known, so this counts every attempt; `formFailed` carries the rejections.
   *  Successful submits = `formSubmitted − formFailed`. */
  formSubmitted: number;
  /** Visitors whose submit was rejected at `/api/forms/submit` (audit gap #1).
   *  Fired by `FormBlock` after a `!res.ok` response. Pairs with
   *  `formSubmitted`. */
  formFailed: number;
  /** True once any tracked traffic exists for the surface. */
  hasData: boolean;
};

/** Page-engagement totals for one surface over the window. */
export type SurfacePageTotals = {
  visits: number;
  uniqueVisitors: number;
  /** Mean time-on-page in seconds, or null when unknown. */
  avgSeconds: number | null;
  lcpP75: number | null;
  clsP75: number | null;
  inpP75: number | null;
  hasData: boolean;
};

const EMPTY_FUNNEL: SurfaceFunnelTotals = {
  landing: 0,
  engaged: 0,
  formStarted: 0,
  formSubmitted: 0,
  formFailed: 0,
  hasData: false,
};

const EMPTY_PAGE: SurfacePageTotals = {
  visits: 0,
  uniqueVisitors: 0,
  avgSeconds: null,
  lcpP75: null,
  clsP75: null,
  inpP75: null,
  hasData: false,
};

/** First day (inclusive) of the rollup window, as a 'YYYY-MM-DD' string. */
function windowStartDay(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (ANALYTICS_WINDOW_DAYS - 1));
  return d.toISOString().slice(0, 10);
}

type FunnelRollupRow = {
  stage: string;
  unique_visitors: number;
};

/** Tracked funnel totals for one website / funnel surface. */
export async function fetchSurfaceFunnelTotals(
  surfaceId: string,
): Promise<SurfaceFunnelTotals> {
  try {
    const { data, error } = await supabase
      .from('analytics_funnel_daily')
      .select('stage, unique_visitors')
      .eq('surface_id', surfaceId)
      .gte('day', windowStartDay());
    if (error || !data) return EMPTY_FUNNEL;
    const rows = data as FunnelRollupRow[];
    if (rows.length === 0) return EMPTY_FUNNEL;
    const sumStage = (stage: string) =>
      rows
        .filter((r) => r.stage === stage)
        .reduce((n, r) => n + (r.unique_visitors ?? 0), 0);
    return {
      landing: sumStage('landing'),
      engaged: sumStage('engaged'),
      formStarted: sumStage('form_started'),
      formSubmitted: sumStage('form_submitted'),
      formFailed: sumStage('form_failed'),
      hasData: true,
    };
  } catch {
    return EMPTY_FUNNEL;
  }
}

type PageRollupRow = {
  visits: number;
  unique_visitors: number;
  avg_seconds: number | null;
  lcp_p75: number | null;
  cls_p75: number | null;
  inp_p75: number | null;
};

/** Page-engagement totals for one website surface. */
export async function fetchSurfacePageTotals(
  surfaceId: string,
): Promise<SurfacePageTotals> {
  try {
    const { data, error } = await supabase
      .from('analytics_page_daily')
      .select('visits, unique_visitors, avg_seconds, lcp_p75, cls_p75, inp_p75')
      .eq('surface_id', surfaceId)
      .gte('day', windowStartDay());
    if (error || !data) return EMPTY_PAGE;
    const rows = data as PageRollupRow[];
    if (rows.length === 0) return EMPTY_PAGE;

    const visits = rows.reduce((n, r) => n + (r.visits ?? 0), 0);
    const uniqueVisitors = rows.reduce((n, r) => n + (r.unique_visitors ?? 0), 0);
    const avg = (pick: (r: PageRollupRow) => number | null): number | null => {
      const vals = rows
        .map(pick)
        .filter((v): v is number => typeof v === 'number');
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    return {
      visits,
      uniqueVisitors,
      avgSeconds: avg((r) => r.avg_seconds),
      lcpP75: avg((r) => r.lcp_p75),
      clsP75: avg((r) => r.cls_p75),
      inpP75: avg((r) => r.inp_p75),
      hasData: true,
    };
  } catch {
    return EMPTY_PAGE;
  }
}

// ---- derived presentation helpers ------------------------------------------

/** A 0–100 page-speed score from the Web-Vital p75s — a Lighthouse-flavoured
 *  composite (LCP 50% / CLS 25% / INP 25%). Returns null when no vitals were
 *  recorded. Thresholds follow the published "good / needs-improvement" bands.
 */
export function pageSpeedScore(
  lcpMs: number | null,
  cls: number | null,
  inpMs: number | null,
): number | null {
  if (lcpMs === null && cls === null && inpMs === null) return null;

  // Each metric → a 0–1 sub-score (1 = good, 0 = poor).
  const band = (value: number, good: number, poor: number): number => {
    if (value <= good) return 1;
    if (value >= poor) return 0;
    return 1 - (value - good) / (poor - good);
  };
  const lcpScore = lcpMs === null ? null : band(lcpMs, 2500, 4000);
  const clsScore = cls === null ? null : band(cls, 0.1, 0.25);
  const inpScore = inpMs === null ? null : band(inpMs, 200, 500);

  let total = 0;
  let weight = 0;
  if (lcpScore !== null) {
    total += lcpScore * 0.5;
    weight += 0.5;
  }
  if (clsScore !== null) {
    total += clsScore * 0.25;
    weight += 0.25;
  }
  if (inpScore !== null) {
    total += inpScore * 0.25;
    weight += 0.25;
  }
  if (weight === 0) return null;
  return Math.round((total / weight) * 100);
}

/** Format a seconds count as 'm:ss' (e.g. 95 → '1:35'). */
export function formatDwell(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
