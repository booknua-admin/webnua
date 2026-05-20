'use client';

// =============================================================================
// PageThumbnail — small CSS "wireframe gist" of a page's visual structure.
// Used in `PageGridCard` (the website hub) as a placeholder for a real
// screenshot — the public-render pipeline that would produce real thumbnails
// is V2 (CLAUDE.md "Public site rendering" gap).
//
// Each page type maps to a distinct layout silhouette so the cards are
// visually scannable: home shows a hero band + service chips, about shows
// image + text, services shows a list, contact shows text + map block,
// generic shows simple bars. Pure CSS — no SVG, no images.
// =============================================================================

import { cn } from '@/lib/utils';
import type { Page } from '@/lib/website/types';

export type PageThumbnailProps = {
  type: Page['type'];
  className?: string;
};

export function PageThumbnail({ type, className }: PageThumbnailProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative h-[160px] w-full overflow-hidden rounded-md bg-paper',
        className,
      )}
    >
      {type === 'home' ? <HomeThumb /> : null}
      {type === 'about' ? <AboutThumb /> : null}
      {type === 'services' ? <ServicesThumb /> : null}
      {type === 'contact' ? <ContactThumb /> : null}
      {type === 'generic' ? <GenericThumb /> : null}
    </div>
  );
}

// --- per-type silhouettes ---------------------------------------------------

function Topbar() {
  return (
    <div className="flex items-center gap-1.5 border-b border-paper-2 bg-paper px-2.5 py-1.5">
      <span className="h-2 w-7 rounded-sm bg-ink/85" />
      <span className="h-1.5 flex-1 rounded-sm bg-paper-2" />
    </div>
  );
}

function HomeThumb() {
  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        {/* Hero band: rust accent block left, dark block right */}
        <div className="flex h-12 gap-1.5">
          <div className="flex flex-1 items-center bg-paper-2 px-2">
            <div className="h-2 w-10 rounded-sm bg-rust" />
          </div>
          <div className="h-full w-[42%] rounded-sm bg-ink" />
        </div>
        {/* 3 service chips */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="h-5 rounded-sm bg-rust-soft" />
          <div className="h-5 rounded-sm bg-rust-soft" />
          <div className="h-5 rounded-sm bg-rust-soft" />
        </div>
        {/* Text bars */}
        <div className="h-1.5 w-3/4 rounded-sm bg-paper-2" />
        <div className="h-1.5 w-1/2 rounded-sm bg-paper-2" />
      </div>
    </div>
  );
}

function AboutThumb() {
  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <div className="flex flex-1 gap-2 p-2.5">
        {/* Image block (left) */}
        <div className="relative h-full w-[45%] overflow-hidden rounded-sm bg-ink">
          <div className="absolute bottom-1 left-1 h-1 w-8 rounded-sm bg-rust" />
        </div>
        {/* Text bars (right) */}
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <div className="h-1.5 w-full rounded-sm bg-paper-2" />
          <div className="h-1.5 w-11/12 rounded-sm bg-paper-2" />
          <div className="h-1.5 w-3/4 rounded-sm bg-paper-2" />
          <div className="h-1.5 w-5/6 rounded-sm bg-paper-2" />
          <div className="h-1.5 w-2/3 rounded-sm bg-paper-2" />
        </div>
      </div>
    </div>
  );
}

function ServicesThumb() {
  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rust" />
            <span className="h-1.5 flex-1 rounded-sm bg-paper-2" />
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
          </div>
        ))}
        <div className="mt-auto self-start rounded-pill bg-rust px-2 py-0.5 font-mono text-[7px] font-bold uppercase tracking-[0.1em] text-paper">
          + NEW SERVICE
        </div>
      </div>
    </div>
  );
}

function ContactThumb() {
  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <div className="flex flex-1 gap-2 p-2.5">
        {/* Text + form bars (left) */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="h-1.5 w-3/4 rounded-sm bg-paper-2" />
          <div className="h-1.5 w-1/2 rounded-sm bg-paper-2" />
          <div className="mt-1 h-3.5 rounded-sm border border-paper-2 bg-card" />
          <div className="h-3.5 rounded-sm border border-paper-2 bg-card" />
        </div>
        {/* Map block (right) */}
        <div className="relative h-full w-[42%] overflow-hidden rounded-sm bg-info/15">
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] leading-none text-rust">
            ◉
          </span>
        </div>
      </div>
    </div>
  );
}

function GenericThumb() {
  return (
    <div className="flex h-full flex-col">
      <Topbar />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="h-2 w-1/2 rounded-sm bg-ink/85" />
        <div className="h-1.5 w-full rounded-sm bg-paper-2" />
        <div className="h-1.5 w-11/12 rounded-sm bg-paper-2" />
        <div className="h-1.5 w-2/3 rounded-sm bg-paper-2" />
        <div className="mt-1 h-1.5 w-3/4 rounded-sm bg-paper-2" />
      </div>
    </div>
  );
}
