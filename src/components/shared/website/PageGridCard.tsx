'use client';

// =============================================================================
// PageGridCard — single page card on the website hub. Shows page type +
// slug + title + section count + "Open editor →" link.
//
// The "Open editor →" link is always visible — view-only users still need
// to inspect the page. Capability gating happens inside the editor (which
// controls they can interact with), not at the entry point.
// =============================================================================

import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { Page } from '@/lib/website/types';

export type PageGridCardProps = {
  page: Page;
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

export function PageGridCard({ page }: PageGridCardProps) {
  const enabledCount = page.sections.filter((s) => s.enabled).length;

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
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          <strong className="text-ink">{enabledCount}</strong> of{' '}
          {page.sections.length} sections on
        </p>
      </div>
      <div className="border-t border-rule bg-paper-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust group-hover:text-rust-deep">
        Open editor →
      </div>
    </Link>
  );
}
