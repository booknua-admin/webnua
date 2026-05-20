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
  /** Visitors who scrolled past 25%. (analytics-audit §4) */
  scrolled25: number;
  /** Visitors who scrolled past 50% — the canonical "engaged" stage. */
  engaged: number;
  /** Visitors who scrolled past 75%. (analytics-audit §4) */
  scrolled75: number;
  /** Visitors who scrolled past 90% — the near-bottom heuristic. (audit §4) */
  scrolled90: number;
  /** Visitors who focused a form field. */
  formStarted: number;
  /** Visitors who started a form, then left the page without submitting
   *  (analytics-audit §5.2 gap #2). Fired by the tracker on
   *  `pagehide` / `visibilitychange→hidden`. */
  formAbandoned: number;
  /** Visitors who submitted (analytics-audit §5.2 gap #1). "Submit attempted"
   *  semantics — the capture-phase listener fires before the API result is
   *  known, so this counts every attempt; `formFailed` carries the rejections.
   *  Successful submits = `formSubmitted − formFailed`. */
  formSubmitted: number;
  /** Visitors whose submit was rejected at `/api/forms/submit` (audit gap #1).
   *  Fired by `FormBlock` after a `!res.ok` response. Pairs with
   *  `formSubmitted`. */
  formFailed: number;
  /** Total CTA clicks across all elements (sum of every per-element row). */
  ctaClickTotal: number;
  /** True once any tracked traffic exists for the surface. */
  hasData: boolean;
};

/** A single per-element CTA click row over the window (analytics-audit §4).
 *  Aggregated from `analytics_funnel_daily` rows with `stage = 'cta_click'`
 *  and `element_label` populated. Empty-label clicks (e.g. icon-only buttons
 *  the tracker couldn't extract a label from) are bucketed as "(no label)". */
export type SurfaceClickBreakdown = {
  label: string;
  clicks: number;
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
  scrolled25: 0,
  engaged: 0,
  scrolled75: 0,
  scrolled90: 0,
  formStarted: 0,
  formAbandoned: 0,
  formSubmitted: 0,
  formFailed: 0,
  ctaClickTotal: 0,
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

/** First day (inclusive) of a `days`-long rollup window, as 'YYYY-MM-DD'.
 *  Defaults to the dashboard's 7-day window; per-page cards on `/website` pass
 *  30 to render a longer-range visit count. */
function windowStartDay(days: number = ANALYTICS_WINDOW_DAYS): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

type FunnelRollupRow = {
  stage: string;
  unique_visitors: number;
};

/** Per-step funnel totals for one funnel surface — keyed by step `page_ref`
 *  (the funnel step's slug, '' for the landing step which is served at the
 *  funnel root). Built from the `(surface_id, day, stage, page_ref)` rollup
 *  rows added by migration 0042. Used by the `/funnels/[id]` detail surface
 *  to render per-step visitor counts + step-to-step drop-off. */
export type FunnelStepTotals = {
  pageRef: string;
  landing: number;
  formStarted: number;
  formAbandoned: number;
  formSubmitted: number;
  formFailed: number;
};

/** Step-by-step drop-off summary for one funnel surface. Derived at read
 *  time — the rollup stores counts, the read layer computes the rates. */
export type FunnelStepBreakdown = {
  /** Per-step totals in the order the caller requested (matches `pageRefs`
   *  argument). Steps with no rollup row resolve to a zero-filled entry so
   *  the dashboard can render every step uniformly. */
  steps: FunnelStepTotals[];
  /** Overall conversion: form_submitted on the last step / page_view on the
   *  first step. Null when there is no first-step traffic. */
  overallConversion: number | null;
  /** True once any step has tracked traffic. */
  hasData: boolean;
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
      scrolled25: sumStage('scrolled_25'),
      engaged: sumStage('engaged'),
      scrolled75: sumStage('scrolled_75'),
      scrolled90: sumStage('scrolled_90'),
      formStarted: sumStage('form_started'),
      formAbandoned: sumStage('form_abandoned'),
      formSubmitted: sumStage('form_submitted'),
      formFailed: sumStage('form_failed'),
      ctaClickTotal: sumStage('cta_click'),
      hasData: true,
    };
  } catch {
    return EMPTY_FUNNEL;
  }
}

type FunnelStepRollupRow = {
  stage: string;
  unique_visitors: number;
  page_ref: string | null;
};

/** Per-step funnel breakdown over the window. `pageRefs` is the ordered list
 *  of step slugs (the funnel's landing step is served at the funnel root and
 *  reports as `''` — pass `''` first). The reading is per-step + the implied
 *  arrows: step N+1's `landing` divided by step N's `landing` is the reach
 *  rate between steps; the last step's `form_submitted` divided by the first
 *  step's `landing` is the overall conversion.
 *
 *  Backwards-compatible with single-page funnel surfaces: a website surface
 *  that has only ever fired one `page_ref` produces a single-step breakdown
 *  whose `landing` matches `fetchSurfaceFunnelTotals(...).landing` exactly.
 *  Designed for the `/funnels/[id]` detail page per the prototype Screen 23
 *  spec; the per-step axis is the analytics-audit §2.2 / §2.6 close. */
export async function fetchFunnelStepBreakdown(
  surfaceId: string,
  pageRefs: readonly string[],
): Promise<FunnelStepBreakdown> {
  const emptyStep = (pageRef: string): FunnelStepTotals => ({
    pageRef,
    landing: 0,
    formStarted: 0,
    formAbandoned: 0,
    formSubmitted: 0,
    formFailed: 0,
  });
  const empty: FunnelStepBreakdown = {
    steps: pageRefs.map(emptyStep),
    overallConversion: null,
    hasData: false,
  };
  try {
    const { data, error } = await supabase
      .from('analytics_funnel_daily')
      .select('stage, unique_visitors, page_ref')
      .eq('surface_id', surfaceId)
      .gte('day', windowStartDay());
    if (error || !data) return empty;
    // Cast through unknown — `page_ref` was added to the funnel rollup PK by
    // migration 0042 and won't appear in the generated DB types until the
    // type-gen is re-run.
    const rows = data as unknown as FunnelStepRollupRow[];
    if (rows.length === 0) return empty;

    // Group rows by page_ref, accumulating per-stage counts. Unknown step
    // slugs (rollup rows whose page_ref isn't in `pageRefs`) are dropped
    // here — they belong to a step the caller didn't ask about (e.g. an
    // archived step slug from an earlier funnel version).
    const byRef = new Map<string, FunnelStepTotals>();
    for (const ref of pageRefs) byRef.set(ref, emptyStep(ref));
    for (const r of rows) {
      const ref = r.page_ref ?? '';
      const bucket = byRef.get(ref);
      if (!bucket) continue;
      const n = r.unique_visitors ?? 0;
      switch (r.stage) {
        case 'landing':
          bucket.landing += n;
          break;
        case 'form_started':
          bucket.formStarted += n;
          break;
        case 'form_abandoned':
          bucket.formAbandoned += n;
          break;
        case 'form_submitted':
          bucket.formSubmitted += n;
          break;
        case 'form_failed':
          bucket.formFailed += n;
          break;
      }
    }

    const steps = pageRefs.map((ref) => byRef.get(ref) ?? emptyStep(ref));
    const firstLanding = steps[0]?.landing ?? 0;
    const lastSubmitted = steps[steps.length - 1]?.formSubmitted ?? 0;
    const overallConversion = firstLanding > 0
      ? lastSubmitted / firstLanding
      : null;
    const hasData = steps.some(
      (s) =>
        s.landing > 0 ||
        s.formStarted > 0 ||
        s.formAbandoned > 0 ||
        s.formSubmitted > 0,
    );
    return { steps, overallConversion, hasData };
  } catch {
    return empty;
  }
}

/** Booked-from-this-funnel count over the window.
 *
 *  **Returns `null` until `source_funnel_id` is added to `leads`.** The
 *  follow-up session will populate the real query (one straight count over
 *  `leads` filtered by `source_funnel_id = funnelId` + status ∈ {booked,
 *  completed} + within `dateRange`). The signature is shaped now so the
 *  funnel hero card binds to a stable surface — the only change in the
 *  follow-up is this function's body. See CLAUDE.md parked decision
 *  "Funnel-to-lead attribution". */
export async function getBookedFromFunnelCount(
  // The follow-up wires both. They are referenced via the void-cast below so
  // strict-mode unused-arg lint doesn't fire today.
  funnelId: string,
  dateRange: { start: Date; end: Date } | null = null,
): Promise<number | null> {
  void funnelId;
  void dateRange;
  return null;
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

type ClickRollupRow = {
  element_label: string;
  unique_visitors: number;
  event_count: number;
};

/** Per-CTA click breakdown over the window — the data behind the `/website`
 *  "Top CTAs by clicks" panel. Sums `event_count` across days per
 *  `element_label`, sorts descending, caps at `limit`. (analytics-audit §4) */
export async function fetchSurfaceClickBreakdown(
  surfaceId: string,
  limit: number = 5,
): Promise<SurfaceClickBreakdown[]> {
  try {
    const { data, error } = await supabase
      .from('analytics_funnel_daily')
      .select('element_label, unique_visitors, event_count')
      .eq('surface_id', surfaceId)
      .eq('stage', 'cta_click')
      .gte('day', windowStartDay());
    if (error || !data) return [];
    // Cast through unknown — the `element_label` column was added by
    // migration 0041 and won't appear in the generated DB types until the
    // type-gen is re-run.
    const rows = data as unknown as ClickRollupRow[];
    if (rows.length === 0) return [];
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = (r.element_label || '').trim() || '(no label)';
      totals.set(key, (totals.get(key) ?? 0) + (r.event_count ?? 0));
    }
    return [...totals.entries()]
      .map(([label, clicks]) => ({ label, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, limit);
  } catch {
    return [];
  }
}

type PageRollupRowWithRef = PageRollupRow & { page_ref: string };

/** Daily visit counts for one surface — the data the `/website` hero
 *  sparkline reads. Returns an oldest→newest array of `{ day, visits }`,
 *  zero-filled for days with no rollup row. */
export async function fetchPageVisitsDaily(
  surfaceId: string,
  days: number = 30,
): Promise<{ day: string; visits: number }[]> {
  const start = windowStartDay(days);
  const series: { day: string; visits: number }[] = [];
  // Build the zero-filled day list up front so the sparkline has stable
  // length regardless of which days produced events.
  const startDate = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setUTCDate(startDate.getUTCDate() + i);
    series.push({ day: d.toISOString().slice(0, 10), visits: 0 });
  }
  try {
    const { data, error } = await supabase
      .from('analytics_page_daily')
      .select('day, visits')
      .eq('surface_id', surfaceId)
      .gte('day', start);
    if (error || !data) return series;
    const byDay = new Map<string, number>();
    for (const row of data as { day: string; visits: number }[]) {
      const key = row.day.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + (row.visits ?? 0));
    }
    return series.map((s) => ({ day: s.day, visits: byDay.get(s.day) ?? 0 }));
  } catch {
    return series;
  }
}

/** Per-page totals over a custom window — keyed by page slug (page_ref).
 *  `/website` page cards use `days = 30` so visit counts match the prototype's
 *  "VISITS 30D" framing. Returns a Map keyed on page_ref; absent slugs mean
 *  "no tracked traffic for that page in the window". */
export async function fetchPageTotalsByRef(
  surfaceId: string,
  days: number = 30,
): Promise<Map<string, SurfacePageTotals>> {
  const out = new Map<string, SurfacePageTotals>();
  try {
    const { data, error } = await supabase
      .from('analytics_page_daily')
      .select(
        'page_ref, visits, unique_visitors, avg_seconds, lcp_p75, cls_p75, inp_p75',
      )
      .eq('surface_id', surfaceId)
      .gte('day', windowStartDay(days));
    if (error || !data) return out;
    const rows = data as PageRollupRowWithRef[];
    const groups = new Map<string, PageRollupRowWithRef[]>();
    for (const r of rows) {
      const key = r.page_ref ?? '';
      const bucket = groups.get(key) ?? [];
      bucket.push(r);
      groups.set(key, bucket);
    }
    for (const [pageRef, group] of groups) {
      const visits = group.reduce((n, r) => n + (r.visits ?? 0), 0);
      const uniqueVisitors = group.reduce(
        (n, r) => n + (r.unique_visitors ?? 0),
        0,
      );
      const avg = (pick: (r: PageRollupRowWithRef) => number | null): number | null => {
        const vals = group
          .map(pick)
          .filter((v): v is number => typeof v === 'number');
        if (vals.length === 0) return null;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      out.set(pageRef, {
        visits,
        uniqueVisitors,
        avgSeconds: avg((r) => r.avg_seconds),
        lcpP75: avg((r) => r.lcp_p75),
        clsP75: avg((r) => r.cls_p75),
        inpP75: avg((r) => r.inp_p75),
        hasData: visits > 0,
      });
    }
    return out;
  } catch {
    return out;
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
