'use client';

// =============================================================================
// PageGridCard — single page card on the website hub. Prototype-aligned shape:
//
//   • Wireframe thumbnail header (per page type — home/about/services/etc.)
//     with a LIVE pill in the top-right when the website has a published
//     version. The thumbnail is a CSS/SVG "gist" of the page's section
//     layout — not a real screenshot (the public-render pipeline is V2).
//   • Body: rust mono domain · slug, page title, 2-stat row keyed by page
//     type, then EDITED Nd AGO · BY YOU/WEBNUA meta.
//   • Footer: View (secondary) + Edit (primary) button row.
//
// Per-page metric availability (analytics-audit follow-ups):
//
//   • VISITS 30D + AVG TIME — derived from `analytics_page_daily` keyed by
//     page slug; per-page, accurate today.
//   • BOUNCE (1 − engaged / landing) and SUBMITS — only surface-level today.
//     The funnel rollup PK is `(surface_id, day, stage[, element_label])`
//     with no `page_ref`, so per-page splits aren't queryable. **Session B**
//     (`analytics-audit §2.2`) is the design pass that adds `page_ref` to
//     the funnel PK and unlocks per-page funnel-stage queries; until then
//     these cards either show "—" or fall back to the surface total with
//     no per-page split. See the parked decision in CLAUDE.md.
// =============================================================================

import Link from 'next/link';

import type { SurfacePageTotals } from '@/lib/analytics/queries';
import { formatDwell } from '@/lib/analytics/queries';
import { cn } from '@/lib/utils';
import type { Page } from '@/lib/website/types';

import { PageThumbnail } from './PageThumbnail';

export type PageGridCardProps = {
  page: Page;
  /** Per-page tracked totals over 30 days — fetched once at the hub level
   *  and passed down keyed by slug. */
  totals?: SurfacePageTotals;
  /** Website domain — rendered in the rust mono URL line. */
  domain: string;
  /** "BY YOU" / "BY WEBNUA" — resolved from the latest version's createdBy. */
  editedBy: 'you' | 'webnua';
  /** Relative edit time, e.g. "2d AGO". */
  editedAgo: string;
  /** True when the website has a published version — drives the LIVE pill
   *  AND the View button (it opens the live page in a new tab; on an
   *  unpublished page the button is rendered inert with a tooltip). */
  isLive: boolean;
};

const PAGE_TYPE_LABEL: Record<Page['type'], string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  generic: 'Page',
};

function formatN(n: number): string {
  return n.toLocaleString('en-US');
}

/** The live-site path for a page — '' for home, '/<slug>' for everything
 *  else. The renderer at /published/[host]/[[...slug]] serves the home page
 *  at '/'. */
function pagePath(page: Page): string {
  if (page.type === 'home' || page.slug === 'index' || page.slug === '') {
    return '';
  }
  return `/${page.slug}`;
}

export function PageGridCard({
  page,
  totals,
  domain,
  editedBy,
  editedAgo,
  isLive,
}: PageGridCardProps) {
  const hasTraffic = !!totals?.hasData;

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-card transition-colors hover:border-ink/20">
      {/* Thumbnail wireframe with LIVE pill */}
      <div className="relative bg-paper-2 px-4 pb-3 pt-4">
        {isLive ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-paper">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-good" />
            LIVE
          </span>
        ) : null}
        <PageThumbnail type={page.type} />
      </div>

      {/* Body */}
      <div className="px-4 pb-3 pt-3.5">
        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-quiet">
          <span className="mr-1 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-good align-middle" />
          {domain}
          {page.slug === 'index' || page.slug === '' || page.type === 'home'
            ? ''
            : `/${page.slug}`}
        </p>
        <p className="mt-1 text-[18px] font-extrabold leading-tight tracking-[-0.01em] text-ink">
          {page.title || PAGE_TYPE_LABEL[page.type]}
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 rounded-md bg-paper px-3 py-2.5 sm:grid-cols-2">
          <StatCell
            label="// VISITS 30D"
            value={hasTraffic ? formatN(totals.visits) : '—'}
            sub={hasTraffic ? `${formatN(totals.uniqueVisitors)} unique` : 'Awaiting'}
            accent={hasTraffic}
          />
          <PageTypeStat page={page} totals={totals} />
        </div>

        <p className="mt-3 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          <span>
            EDITED <strong className="text-ink">{editedAgo}</strong>
          </span>
          <span className={editedBy === 'you' ? 'text-rust' : 'text-info'}>
            BY {editedBy === 'you' ? 'YOU' : 'WEBNUA'}
          </span>
        </p>
      </div>

      {/* Action row — View (opens live page in new tab) + Edit (editor) */}
      <div className="grid grid-cols-2 gap-2 border-t border-rule bg-paper-2 px-3 py-3">
        {isLive ? (
          <a
            href={`https://${domain}${pagePath(page)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center justify-center rounded-md border border-rule bg-card text-[13px] font-bold text-ink transition-colors hover:border-ink/30"
          >
            View ↗
          </a>
        ) : (
          <span
            title="Publish this page to view it live."
            className="inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border border-rule bg-card text-[13px] font-bold text-ink-quiet/60"
          >
            View
          </span>
        )}
        <Link
          href={`/website/${page.id}`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-rust text-[13px] font-bold text-paper transition-colors hover:bg-rust-deep"
        >
          Edit
        </Link>
      </div>
    </div>
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
          'mt-0.5 text-[20px] font-extrabold leading-tight tracking-[-0.02em]',
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

/** Per-page-type variant stat in the card's right cell. The labels match the
 *  prototype (BOUNCE / AVG TIME / → FUNNEL / SUBMITS); the values fall back
 *  to "—" when not derivable from today's schema (Session B will populate
 *  the missing per-page splits — see comment at top of file). */
function PageTypeStat({
  page,
  totals,
}: {
  page: Page;
  totals?: SurfacePageTotals;
}) {
  const hasTraffic = !!totals?.hasData;

  // VISITS + AVG TIME are reliably per-page (analytics_page_daily.page_ref).
  // BOUNCE / SUBMITS / FUNNEL CTR want per-page splits of `engaged` /
  // `form_submitted` / `cta_click` — which the funnel rollup doesn't carry
  // until Session B. Render "—" rather than mis-attributing a surface total
  // to one page.
  switch (page.type) {
    case 'about':
    case 'home':
    case 'services':
    case 'contact':
    case 'generic':
    default:
      return (
        <StatCell
          label="// AVG TIME"
          value={hasTraffic ? formatDwell(totals.avgSeconds) : '—'}
          sub={
            hasTraffic && totals.avgSeconds && totals.avgSeconds >= 30
              ? 'read fully'
              : hasTraffic
                ? 'on page'
                : 'Awaiting'
          }
        />
      );
  }
}
