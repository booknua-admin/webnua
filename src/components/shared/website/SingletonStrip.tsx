'use client';

// =============================================================================
// SingletonStrip — full-width Header / Footer card for the `/website` hub.
//
// Replaces the previous 3-up SingletonCard row (Header / Footer / Nav as
// equal-width cards) with two slim strips that sit ABOVE and BELOW the page
// grid, mirroring their actual visual position on the rendered website.
//
//   • Header strip: logo + nav-links wireframe + CTA pill + Edit link.
//   • Footer strip: 3-col link-bars wireframe + legal line + Edit link.
//
// Nav data lives on `Website.nav` (separate from `HeaderData`). The header
// strip folds the link count into its meta line; full nav editing still
// happens via the Header editor.
// =============================================================================

import Link from 'next/link';

import type { NavLink, Section } from '@/lib/website/types';

export type SingletonStripProps = {
  variant: 'header' | 'footer';
  section: Section;
  /** Used only by the header variant — the live nav link list. */
  nav?: NavLink[];
};

export function SingletonStrip({ variant, section, nav }: SingletonStripProps) {
  const href = variant === 'header' ? '/website/header' : '/website/footer';
  const label = variant === 'header' ? 'Header' : 'Footer';
  const eyebrow =
    variant === 'header'
      ? '// HEADER · wraps every page'
      : '// FOOTER · wraps every page';

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-rule bg-card px-4 py-3 transition-colors hover:border-ink/20"
    >
      <div className="hidden w-[180px] flex-shrink-0 md:block">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {eyebrow}
        </p>
        <p className="mt-0.5 text-[13.5px] font-bold text-ink">
          {label} · singleton
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          {section.enabled ? 'On' : 'Off'}
          {variant === 'header' && nav
            ? ` · ${nav.length} nav ${nav.length === 1 ? 'link' : 'links'}`
            : ''}
        </p>
      </div>

      {/* Wireframe gist — fills the remaining horizontal space */}
      <div className="min-w-0 flex-1">
        {variant === 'header' ? <HeaderGist nav={nav ?? []} /> : <FooterGist />}
      </div>

      <span className="ml-auto flex-shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust group-hover:text-rust-deep">
        Edit {label.toLowerCase()} →
      </span>
    </Link>
  );
}

function HeaderGist({ nav }: { nav: NavLink[] }) {
  const links = nav.slice(0, 5);
  return (
    <div
      aria-hidden
      className="flex h-9 items-center gap-3 rounded-md bg-paper px-3"
    >
      <span className="h-2 w-12 rounded-sm bg-ink/85" />
      <div className="flex flex-1 items-center gap-3 overflow-hidden">
        {links.length === 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet/60">
            No nav links
          </span>
        ) : (
          links.map((l, i) => (
            <span
              key={i}
              className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet"
            >
              {l.label}
            </span>
          ))
        )}
      </div>
      <span className="rounded-pill bg-rust px-2.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-paper">
        CTA
      </span>
    </div>
  );
}

function FooterGist() {
  return (
    <div
      aria-hidden
      className="flex h-9 items-center gap-3 rounded-md bg-ink px-3"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-1 flex-col gap-1">
          <span className="h-1.5 w-12 rounded-sm bg-paper/30" />
          <span className="h-1 w-16 rounded-sm bg-paper/15" />
        </div>
      ))}
      <span className="ml-auto h-1 w-10 rounded-sm bg-paper/15" />
    </div>
  );
}
