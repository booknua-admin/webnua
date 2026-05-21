'use client';

// =============================================================================
// Website nav slot — passes the real `Website.nav` into the header section's
// Preview without widening the section-registry `Preview(data, brand)`
// contract. Mirrors the section-form-slot pattern.
//
// The public-site renderer resolves `Website.nav` into `{ label, href }`
// links and wraps the rendered site in `WebsiteNavProvider`; the header
// section reads it via `useWebsiteNav`. With no provider the hook returns
// null and the header falls back to its representative sample links.
//
// `live` distinguishes the public site (links navigate) from the header
// editor (`live: false` — the real labels show, but the links are inert so
// a click selects the element instead of navigating away).
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';

import type { NavLink, NavLinkTarget, Page } from '@/lib/website/types';

export type ResolvedNavLink = { label: string; href: string };

export type WebsiteNavContextValue = {
  links: ResolvedNavLink[];
  /** true on the public site; false in the header editor. */
  live: boolean;
};

const WebsiteNavContext = createContext<WebsiteNavContextValue | null>(null);

export function WebsiteNavProvider({
  links,
  live = true,
  children,
}: {
  links: ResolvedNavLink[];
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <WebsiteNavContext.Provider value={{ links, live }}>
      {children}
    </WebsiteNavContext.Provider>
  );
}

/** The real site nav, or null when rendered outside a provider. */
export function useWebsiteNav(): WebsiteNavContextValue | null {
  return useContext(WebsiteNavContext);
}

/** Resolve stored `Website.nav` into rendered `{ label, href }` links. The
 *  single source of truth for nav-link resolution — used by the public-site
 *  renderer and the header editor's preview provider. */
export function resolveNavLinks(nav: NavLink[], pages: Page[]): ResolvedNavLink[] {
  return nav.map((link) => ({
    label: link.label,
    href: navHref(link.target, pages),
  }));
}

function navHref(target: NavLinkTarget, pages: Page[]): string {
  if (target.kind === 'href') return target.href || '#';
  const page = pages.find((p) => p.id === target.pageId);
  if (!page) return '#';
  return page.slug === 'home' ? '/' : `/${page.slug}`;
}

// =============================================================================
// Nav EDITING slot — carries the editable nav + the site's pages + a save
// handler into the header section's Fields component, so the menu editor can
// live in the header editor's sidebar without widening the section-registry
// `Fields(data, …)` contract. The header editor route provides it; the menu
// editor reads it via `useWebsiteNavEditing`. Null outside the header editor.
// =============================================================================

export type WebsiteNavEditPage = { id: string; title: string; slug: string };

export type WebsiteNavEditing = {
  pages: WebsiteNavEditPage[];
  nav: NavLink[];
  /** Persist the full nav array to the draft snapshot. */
  onSave: (nav: NavLink[]) => Promise<boolean>;
};

const WebsiteNavEditContext = createContext<WebsiteNavEditing | null>(null);

export function WebsiteNavEditProvider({
  value,
  children,
}: {
  value: WebsiteNavEditing;
  children: ReactNode;
}) {
  return (
    <WebsiteNavEditContext.Provider value={value}>
      {children}
    </WebsiteNavEditContext.Provider>
  );
}

/** The editable site nav + pages + save handler, or null outside the header
 *  editor. */
export function useWebsiteNavEditing(): WebsiteNavEditing | null {
  return useContext(WebsiteNavEditContext);
}
