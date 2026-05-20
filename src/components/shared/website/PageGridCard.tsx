'use client';

// =============================================================================
// PageGridCard — single page card on the website hub. Shows page type +
// slug + title + section count + "Open editor →" link.
//
// As of the analytics-audit §3/§4 close, the card also renders a 2-up
// per-page analytics row (visits 30d + avg time) when tracked totals are
// available for the page — the wireframe-style placeholder the prototype
// showed (VISITS 30D · 1,124 · ↑22% / AVG TIME · 1:42 / etc.) now
// resolves to live data from `analytics_page_daily`, keyed by page slug.
// Cards with no tracked traffic in the 30-day window fall back to the
// "// AWAITING TRAFFIC" placeholder strip rather than rendering zeros.
//
// The "Open editor →" link is always visible — view-only users still need
// to inspect the page. Capability gating happens inside the editor (which
// controls they can interact with), not at the entry point.
// =============================================================================

import Link from 'next/link';

import type { SurfacePageTotals } from '@/lib/analytics/queries';
import { formatDwell } from '@/lib/analytics/queries';
import { cn } from '@/lib/utils';
import type { Page } from '@/lib/website/types';

export type PageGridCardProps = {
  page: Page;
  /** Per-page tracked totals over 30 days — fetched once at the hub level
   *  and passed down keyed by slug. Undefined when the website has no
   *  surface id yet (unpublished) or no analytics rows for this slug. */
  totals?: SurfacePageTotals;
};

const PAGE_TYPE_LABEL: Record<Page['type'], string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  generic: 'Page',
};

const PAGE_TYPE_TONE: Record<Page['type'], string> = {
  home: 'bg-rust text-paper',
  about: 'bg-ink text-paper',
  services: 'bg-good text-paper',
  contact: 'bg-info/15 text-info',
  generic: 'bg-paper-2 text-ink',
};

function formatVisits(n: number): string {
  return n.toLocaleString('en-US');
}

export function PageGridCard({ page, totals }: PageGridCardProps) {
  const enabledCount = page.sections.filter((s) => s.enabled).length;
  const hasData = !!totals?.hasData;

  return (
    <Link
      href={`/website/${page.id}`}
      className="group block overflow-hidden rounded-lg border border-rule bg-card transition-colors hover:border-ink/20"
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b border-rule px-4 py-3',
        )}
      >
        <span
          className={cn(
            'rounded-pill px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
            PAGE_TYPE_TONE[page.type],
          )}
        >
          {PAGE_TYPE_LABEL[page.type]}
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          /{page.slug}
        </span>
      </div>
      <div className="px-4 py-4">
        <p className="mb-1 text-[15px] font-bold leading-tight text-ink">
          {page.title}
        </p>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          <strong className="text-ink">{enabledCount}</strong> of{' '}
          {page.sections.length} sections on
        </p>
        {hasData ? (
          <div className="grid grid-cols-2 gap-2 rounded-md bg-paper px-3 py-2.5">
            <StatCell
              label="// VISITS 30D"
              value={formatVisits(totals.visits)}
              sub={`${formatVisits(totals.uniqueVisitors)} unique`}
              accent
            />
            <StatCell
              label="// AVG TIME"
              value={formatDwell(totals.avgSeconds)}
              sub={totals.avgSeconds && totals.avgSeconds >= 30 ? 'read fully' : 'on page'}
            />
          </div>
        ) : (
          <p className="rounded-md bg-paper px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            {'// Awaiting traffic'}
          </p>
        )}
      </div>
      <div className="border-t border-rule bg-paper-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust group-hover:text-rust-deep">
        Open editor →
      </div>
    </Link>
  );
}

function StatCell({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 text-[18px] font-extrabold leading-tight tracking-[-0.02em]',
          accent ? 'text-rust' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet">
        {sub}
      </p>
    </div>
  );
}
