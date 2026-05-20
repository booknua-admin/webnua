'use client';

// =============================================================================
// WebsiteEngagementCard — surface-level visitor-engagement insights for the
// `/website` hub (analytics-audit §3 / §4).
//
// Three panels in one card. Each is driven by aggregation work that
// previously dropped the underlying events at the rollup boundary:
//
//   • Scroll-depth breakdown — % of visitors reaching 25 / 50 / 75 / 90.
//     Migration 0041 added the three previously-dropped thresholds; the
//     50% step keeps its canonical `engaged` name.
//   • Top CTAs by click count — the per-element rollup added by 0041.
//     Element labels come straight from the tracker's `element_click`
//     payload. Capped at top 5.
//   • Form completion — Started · Abandoned · Submitted. `form_abandoned`
//     was wired by migration 0040; this is the per-surface card view.
//
// The card sits above the page grid on `/website`. Loading and empty
// states render the panel chrome so the layout doesn't jump once data
// lands. Tracked totals fetch is window-bounded by `ANALYTICS_WINDOW_DAYS`
// (7d by default) — the per-page cards below use 30d separately.
// =============================================================================

import { useQuery } from '@tanstack/react-query';

import {
  fetchSurfaceClickBreakdown,
  fetchSurfaceFunnelTotals,
  type SurfaceClickBreakdown,
  type SurfaceFunnelTotals,
} from '@/lib/analytics/queries';
import { cn } from '@/lib/utils';

export type WebsiteEngagementCardProps = {
  /** The website's id — the surface analytics_funnel_daily rows are keyed on. */
  surfaceId: string;
};

export function WebsiteEngagementCard({ surfaceId }: WebsiteEngagementCardProps) {
  const totalsQuery = useQuery({
    queryKey: ['analytics', 'funnel-totals', surfaceId],
    queryFn: () => fetchSurfaceFunnelTotals(surfaceId),
  });
  const clicksQuery = useQuery({
    queryKey: ['analytics', 'click-breakdown', surfaceId],
    queryFn: () => fetchSurfaceClickBreakdown(surfaceId, 5),
  });

  const totals = totalsQuery.data;
  const clicks = clicksQuery.data ?? [];
  const hasAnyData = !!totals?.hasData || clicks.length > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule bg-paper-2 px-5 py-3">
        <h2 className="text-[14px] font-extrabold tracking-[-0.015em] text-ink [&_em]:not-italic [&_em]:text-rust">
          Visitor <em>engagement</em>
        </h2>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {'// LAST 7 DAYS'}
        </span>
      </div>
      {hasAnyData ? (
        <div className="grid gap-5 px-5 py-5 md:grid-cols-3">
          <ScrollDepthPanel totals={totals ?? null} />
          <TopCtasPanel clicks={clicks} />
          <FormCompletionPanel totals={totals ?? null} />
        </div>
      ) : (
        <EmptyState
          loading={totalsQuery.isLoading || clicksQuery.isLoading}
        />
      )}
    </div>
  );
}

// -- Scroll thresholds -------------------------------------------------------

function ScrollDepthPanel({ totals }: { totals: SurfaceFunnelTotals | null }) {
  const landing = totals?.landing ?? 0;
  const thresholds: { label: string; reached: number }[] = [
    { label: '25%', reached: totals?.scrolled25 ?? 0 },
    { label: '50%', reached: totals?.engaged ?? 0 },
    { label: '75%', reached: totals?.scrolled75 ?? 0 },
    { label: '90%', reached: totals?.scrolled90 ?? 0 },
  ];

  return (
    <PanelShell label="// SCROLL DEPTH" subtitle="How far visitors got">
      <ul className="space-y-2">
        {thresholds.map((t) => {
          const pct = landing > 0 ? Math.round((t.reached / landing) * 100) : 0;
          return (
            <li key={t.label} className="flex items-center gap-3">
              <span className="w-9 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink">
                {t.label}
              </span>
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 rounded-full bg-rust transition-[width]"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </span>
              <span className="min-w-[60px] text-right font-mono text-[11px] font-bold tracking-[0.04em] text-ink-quiet">
                <strong className="text-ink">{t.reached.toLocaleString('en-US')}</strong>
                {' · '}
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet">
        Out of <strong className="text-ink">{landing.toLocaleString('en-US')}</strong> landing visits
      </p>
    </PanelShell>
  );
}

// -- Top CTAs ---------------------------------------------------------------

function TopCtasPanel({ clicks }: { clicks: SurfaceClickBreakdown[] }) {
  const max = clicks.reduce((m, c) => Math.max(m, c.clicks), 0);
  return (
    <PanelShell label="// TOP CTAS" subtitle="What visitors clicked">
      {clicks.length === 0 ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          No CTA clicks recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {clicks.map((c) => {
            const pct = max > 0 ? Math.round((c.clicks / max) * 100) : 0;
            return (
              <li key={c.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className="truncate text-[12.5px] font-bold text-ink"
                    title={c.label}
                  >
                    {c.label}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-rust">
                    {c.clicks.toLocaleString('en-US')}
                  </span>
                </div>
                <span className="relative block h-1 overflow-hidden rounded-full bg-paper-2">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-full bg-rust"
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PanelShell>
  );
}

// -- Form completion --------------------------------------------------------

function FormCompletionPanel({ totals }: { totals: SurfaceFunnelTotals | null }) {
  const started = totals?.formStarted ?? 0;
  const abandoned = totals?.formAbandoned ?? 0;
  const submitted = totals?.formSubmitted ?? 0;
  const failed = totals?.formFailed ?? 0;

  const rows = [
    { label: 'Started', value: started, tone: 'neutral' as const },
    { label: 'Abandoned', value: abandoned, tone: 'warn' as const },
    { label: 'Submitted', value: Math.max(0, submitted - failed), tone: 'good' as const },
  ];

  return (
    <PanelShell label="// FORM FUNNEL" subtitle="Started → submitted">
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] font-bold text-ink">{r.label}</span>
            <span
              className={cn(
                'font-mono text-[14px] font-extrabold tracking-[-0.01em]',
                r.tone === 'warn' && 'text-warn',
                r.tone === 'good' && 'text-good',
                r.tone === 'neutral' && 'text-ink',
              )}
            >
              {r.value.toLocaleString('en-US')}
            </span>
          </li>
        ))}
      </ul>
      {failed > 0 ? (
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-warn">
          <strong>{failed.toLocaleString('en-US')}</strong> submit attempts failed at the API
        </p>
      ) : (
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet">
          Started but didn&rsquo;t complete: <strong className="text-ink">{abandoned.toLocaleString('en-US')}</strong>
        </p>
      )}
    </PanelShell>
  );
}

// -- Shared chrome ----------------------------------------------------------

function PanelShell({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
        {label}
      </p>
      <p className="mb-3 text-[11px] text-ink-quiet">{subtitle}</p>
      {children}
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="px-5 py-6 text-center">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {loading ? '// Loading engagement…' : '// Awaiting traffic'}
      </p>
      {!loading ? (
        <p className="mt-2 text-[12px] leading-[1.5] text-ink-quiet">
          Scroll depth, top CTAs, and form completion will appear here as visitors land on this website.
        </p>
      ) : null}
    </div>
  );
}
