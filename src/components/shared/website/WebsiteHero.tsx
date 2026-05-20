'use client';

// =============================================================================
// WebsiteHero — ink-bg hero at the top of `/website`. Replaces the previous
// flat title + paragraph header pattern with the prototype's branded shape:
//
//   • Left: rust LIVE pill (live domain), "Your website + funnel" headline,
//     explainer copy, primary "Request a change" + secondary "Preview live"
//     CTAs.
//   • Right: translucent stat card with MONTHLY VISITS + PAGE SPEED + a
//     30-day visit-trend sparkline (zero-filled days included so the line
//     length stays consistent across surfaces).
//
// Built on the `inkHeroSurface` styling recipe (lib/ink-hero.ts) — not a new
// component class. The right-side stat card composes its own translucent
// surface; new shapes diverge enough across the six ink-heroes that the
// parked decision is to NOT extract them.
// =============================================================================

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import {
  fetchPageVisitsDaily,
  fetchSurfacePageTotals,
  pageSpeedScore,
} from '@/lib/analytics/queries';
import { INK_HERO_TAG_CLASS, inkHeroSurface } from '@/lib/ink-hero';
import { cn } from '@/lib/utils';
import type { Website } from '@/lib/website/types';

export type WebsiteHeroProps = {
  website: Website;
  /** Optional handler for the request-change CTA — when set, the primary
   *  CTA becomes a button calling this; otherwise it falls back to a link
   *  pointing at `/tickets/new?from=request-change`. */
  onRequestChange?: () => void;
};

export function WebsiteHero({ website }: WebsiteHeroProps) {
  const totalsQuery = useQuery({
    queryKey: ['analytics', 'page-totals', website.id, '30d'],
    queryFn: () => fetchSurfacePageTotals(website.id),
  });
  const sparkQuery = useQuery({
    queryKey: ['analytics', 'visits-daily', website.id, 30],
    queryFn: () => fetchPageVisitsDaily(website.id, 30),
  });

  const totals = totalsQuery.data;
  const speed = totals
    ? pageSpeedScore(totals.lcpP75, totals.clsP75, totals.inpP75)
    : null;
  const monthlyVisits = totals?.visits ?? 0;
  const series = sparkQuery.data ?? [];

  return (
    <section className={inkHeroSurface('mb-5 grid gap-6 md:grid-cols-[1.4fr_1fr]')}>
      <div className="flex flex-col justify-center">
        <p className={INK_HERO_TAG_CLASS}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-good align-middle" />
          {`LIVE · ${website.domain.primary}`}
        </p>
        <h1 className="mt-3 text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] [&_em]:not-italic [&_em]:text-rust-light">
          Your <em>website</em> + funnel
        </h1>
        <p className="mt-2.5 max-w-[560px] text-[13.5px] leading-[1.55] text-paper/85 [&_strong]:font-bold [&_strong]:text-paper">
          Edit the pages you own &mdash; text, images, services list, gallery.{' '}
          <strong>Funnel pages are Webnua-managed</strong> and text Craig to
          change. Bigger things &mdash; new pages, redesigns, structural changes
          &mdash; use the request button.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href="/tickets/new?from=request-change&category=website"
            className="inline-flex h-10 items-center rounded-md bg-rust px-4 text-[13px] font-bold text-paper transition-colors hover:bg-rust-deep"
          >
            + Request a change
          </Link>
          {website.publishedVersionId ? (
            <a
              href={`https://${website.domain.primary}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-md border border-paper/20 bg-paper/5 px-4 text-[13px] font-bold text-paper transition-colors hover:bg-paper/10"
            >
              ↗ Preview live site
            </a>
          ) : (
            <span
              className="inline-flex h-10 items-center rounded-md border border-paper/15 bg-paper/[0.03] px-4 text-[13px] font-bold text-paper/40"
              title="Publish this website to preview it live."
            >
              Not published yet
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-paper/15 bg-paper/[0.06] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-paper/60">
            {'// SITE PERFORMANCE · 30 DAYS'}
          </p>
          <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-good">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-good" />
            LIVE
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <StatBlock
            label="// MONTHLY VISITS"
            value={monthlyVisits.toLocaleString('en-US')}
            sub={
              monthlyVisits > 0
                ? `${(totals?.uniqueVisitors ?? 0).toLocaleString('en-US')} unique`
                : 'Awaiting traffic'
            }
            accent
          />
          <StatBlock
            label="// PAGE SPEED"
            value={speed === null ? '—' : String(speed)}
            sub={
              speed === null
                ? 'Awaiting vitals'
                : speed >= 90
                  ? 'all green'
                  : speed >= 50
                    ? 'moderate'
                    : 'needs work'
            }
            tone={speed === null ? 'quiet' : speed >= 50 ? 'good' : 'warn'}
          />
        </div>
        <div className="mt-4">
          <Sparkline data={series.map((s) => s.visits)} />
        </div>
      </div>
    </section>
  );
}

function StatBlock({
  label,
  value,
  sub,
  accent = false,
  tone = 'good',
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  tone?: 'good' | 'warn' | 'quiet';
}) {
  return (
    <div>
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-paper/55">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-[28px] font-extrabold leading-none tracking-[-0.02em]',
          accent ? 'text-rust-light' : 'text-paper',
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          'mt-1 font-mono text-[10px] uppercase tracking-[0.14em]',
          tone === 'good' && 'text-good',
          tone === 'warn' && 'text-warn',
          tone === 'quiet' && 'text-paper/55',
        )}
      >
        {sub}
      </p>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) {
    return <div className="h-10" aria-hidden />;
  }
  const max = Math.max(1, ...data);
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * 100;
      const y = 100 - (v / max) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const areaPoints = `0,100 ${points} 100,100`;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-10 w-full"
      aria-hidden
    >
      <polygon points={areaPoints} fill="rgb(210 67 23 / 0.18)" />
      <polyline
        points={points}
        fill="none"
        stroke="#e8743b"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
