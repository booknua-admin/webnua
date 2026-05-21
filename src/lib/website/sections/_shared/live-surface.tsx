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
import { POPUP_HREF } from '@/lib/website/popup-config';

import { usePopupRuntime, useSectionPopupSlot } from './section-popup-slot';

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
  /** The stored CTA href — a page path (`/about`), `tel:` / `mailto:`, an
   *  external URL, or the `POPUP_HREF` sentinel ("open this section's
   *  popup"). Empty or `#` renders as a non-link. */
  href?: string | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** A section CTA / link. On the live site it renders a navigable `<a>` (a real
 *  href) or a `<button>` (the `POPUP_HREF` sentinel + a configured section
 *  popup); in the editor — or with an empty / `#` href, or no popup configured
 *  — it renders an inert `<span>` so the element stays click-to-select. */
export function SurfaceLink({ href, className, style, children }: SurfaceLinkProps) {
  const live = useIsLiveSurface();
  const popupSlot = useSectionPopupSlot();
  const popupRuntime = usePopupRuntime();

  // Popup trigger — the POPUP_HREF sentinel. On a live surface with a
  // configured section popup AND a runtime to open it, render a button;
  // otherwise (the editor, or no popup configured) fall through to the inert
  // <span> so the element stays click-to-select.
  if (href?.trim() === POPUP_HREF) {
    if (live && popupSlot && popupRuntime) {
      const popup = popupSlot;
      return (
        <button
          type="button"
          onClick={() => popupRuntime.openPopup(popup)}
          className={cn(className, 'no-underline')}
          style={style}
        >
          {children}
        </button>
      );
    }
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }

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
