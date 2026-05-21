'use client';

// =============================================================================
// Live-surface slot — tells a section's Preview whether it is rendering on the
// published public site or inside the editor.
//
// On the live site (wrapped in LiveSurfaceProvider by PublicSiteRenderer) a
// section's CTA renders as a real navigable <a>. In the editor preview there
// is no provider, so the CTA renders an inert <span> — a click selects the
// element for editing instead of navigating away.
//
// SurfaceLink is the shared button/link element every section CTA uses.
// =============================================================================

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const LiveSurfaceContext = createContext(false);

export function LiveSurfaceProvider({ children }: { children: ReactNode }) {
  return <LiveSurfaceContext.Provider value={true}>{children}</LiveSurfaceContext.Provider>;
}

/** True on the published public site; false in the editor preview. */
export function useIsLiveSurface(): boolean {
  return useContext(LiveSurfaceContext);
}

/** Resolve a stored href into a real destination, or null when it is empty
 *  or the `#` placeholder (an un-set CTA href). */
function realHref(href: string | null | undefined): string | null {
  const h = href?.trim();
  return h && h !== '#' ? h : null;
}

export type SurfaceLinkProps = {
  /** The stored CTA href — a page path (`/about`), `tel:` / `mailto:`, or an
   *  external URL. Empty or `#` renders as a non-link. */
  href?: string | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** A section CTA / link. On the live site with a real href it renders a
 *  navigable `<a>`; in the editor (or with an empty / `#` href) it renders an
 *  inert `<span>` so the element stays click-to-select. */
export function SurfaceLink({ href, className, style, children }: SurfaceLinkProps) {
  const live = useIsLiveSurface();
  const dest = realHref(href);
  if (live && dest) {
    return (
      <a href={dest} className={cn(className, 'no-underline')} style={style}>
        {children}
      </a>
    );
  }
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}
