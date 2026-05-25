'use client';

// =============================================================================
// PageTypeContext — Bundle C2b-1.
//
// Page-type-aware section rendering. The renderer (PublicSiteRenderer)
// wraps each page in a provider; sections read the context and branch
// behaviour without a new data field (the brief's locked decision —
// invisible to operators).
//
// V1 use case: the hero section's min-height differs between the home page
// (large, page-dominant role — up to 100vh) and sub-pages (page-header
// role — 40-50vh). A funnel step is "home-like" in scale (its own page-
// dominant hero is the whole point).
//
// Default = 'home' so:
//   - The editor preview (which doesn't currently mount this provider)
//     renders the home/large hero — the most common authoring case.
//   - A renderer that forgets to wrap is the "looks bigger" failure mode,
//     not the "looks like nothing" failure mode.
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';

import type { PageType } from './types';

/** The set of contexts a section knows about. `'funnelStep'` is a
 *  distinct value because funnel steps are page-dominant but are not
 *  website pages (no `Page.type`). */
export type PageTypeContextValue = PageType | 'funnelStep';

const Context = createContext<PageTypeContextValue>('home');

export function PageTypeProvider({
  value,
  children,
}: {
  value: PageTypeContextValue;
  children: ReactNode;
}) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Read the active page-type context. Defaults to `'home'` when no
 *  provider is mounted (the editor preview today; rarely a real customer
 *  surface). Sections branch on the return value to scale chrome. */
export function usePageType(): PageTypeContextValue {
  return useContext(Context);
}

/** True when the active context renders as the page's dominant hero
 *  (home or funnel step). False for sub-pages where the hero plays a
 *  page-header role. */
export function useIsHomeContext(): boolean {
  const ctx = useContext(Context);
  return ctx === 'home' || ctx === 'funnelStep';
}
