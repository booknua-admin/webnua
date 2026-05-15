'use client';

// =============================================================================
// PageReviewCard — Session 8. One card per page on the review surface.
// Shows the page type pill + slug + section count + a per-page preflight
// roll-up (worst status of that page's results). Clicking opens the page
// editor.
//
// The "thumbnail" is a lightweight section-stack glyph rather than a real
// rendered screenshot — same spirit as the website hub's PageGridCard;
// real visual thumbnails wait for a render-to-image backend.
// =============================================================================

import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { PreflightResult, PreflightStatus } from '@/lib/website/preflight';
import type { Page, PageType } from '@/lib/website/types';

const PAGE_TYPE_PILL: Record<PageType, string> = {
  home: 'bg-rust text-paper',
  about: 'bg-ink text-paper',
  services: 'bg-good text-paper',
  contact: 'bg-info text-paper',
  generic: 'bg-paper-2 text-ink',
};

const STATUS_META: Record<
  PreflightStatus,
  { label: string; dot: string; text: string }
> = {
  pass: { label: 'Clear', dot: 'bg-good', text: 'text-good' },
  warn: { label: 'Warnings', dot: 'bg-warn', text: 'text-warn' },
  fail: { label: 'Blockers', dot: 'bg-warn', text: 'text-warn' },
};

function worstStatus(results: PreflightResult[]): PreflightStatus {
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  return 'pass';
}

export type PageReviewCardProps = {
  page: Page;
  /** Preflight results scoped to this page (already filtered by caller). */
  results: PreflightResult[];
};

export function PageReviewCard({ page, results }: PageReviewCardProps) {
  const enabledCount = page.sections.filter((s) => s.enabled).length;
  const status = worstStatus(results);
  const meta = STATUS_META[status];
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warnCount = results.filter((r) => r.status === 'warn').length;

  return (
    <Link
      href={`/website/${page.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-rule bg-card transition-colors hover:border-rust"
    >
      <div className="flex items-center justify-between gap-2 border-b border-rule bg-paper-2 px-4 py-2.5">
        <span
          className={cn(
            'rounded-pill px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em]',
            PAGE_TYPE_PILL[page.type],
          )}
        >
          {page.type}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          /{page.slug}
        </span>
      </div>

      <div className="flex-1 px-4 py-4">
        <p className="truncate text-[14px] font-bold text-ink">{page.title}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {enabledCount} {enabledCount === 1 ? 'section' : 'sections'} on
        </p>

        {/* Section-stack glyph thumbnail */}
        <div className="mt-3 flex flex-col gap-1">
          {page.sections.slice(0, 5).map((s) => (
            <div
              key={s.id}
              className={cn(
                'h-1.5 rounded-full',
                s.enabled ? 'bg-rust/35' : 'bg-paper-2',
              )}
            />
          ))}
          {page.sections.length === 0 ? (
            <div className="h-1.5 rounded-full bg-paper-2" />
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-rule bg-paper-2 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5">
          <span className={cn('size-1.5 rounded-full', meta.dot)} />
          <span
            className={cn(
              'font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
              status === 'pass' ? 'text-ink-quiet' : meta.text,
            )}
          >
            {status === 'pass'
              ? 'Clear'
              : `${failCount > 0 ? `${failCount} blocker${failCount === 1 ? '' : 's'}` : ''}${
                  failCount > 0 && warnCount > 0 ? ' · ' : ''
                }${warnCount > 0 ? `${warnCount} warning${warnCount === 1 ? '' : 's'}` : ''}`}
          </span>
        </span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-rust group-hover:text-rust-deep">
          Open →
        </span>
      </div>
    </Link>
  );
}
