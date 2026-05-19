'use client';

// =============================================================================
// Website nav slot — passes the real `Website.nav` into the header section's
// Preview without widening the section-registry `Preview(data, brand)`
// contract. Mirrors the section-form-slot pattern.
//
// The public-site renderer resolves `Website.nav` into `{ label, href }`
// links and wraps the rendered site in `WebsiteNavProvider`; the header
// section reads it via `useWebsiteNav`. With no provider (e.g. the singleton
// header editor) the hook returns null and the header falls back to its
// representative sample links.
// =============================================================================

import { createContext, useContext, type ReactNode } from 'react';

export type ResolvedNavLink = { label: string; href: string };

const WebsiteNavContext = createContext<ResolvedNavLink[] | null>(null);

export function WebsiteNavProvider({
  links,
  children,
}: {
  links: ResolvedNavLink[];
  children: ReactNode;
}) {
  return (
    <WebsiteNavContext.Provider value={links}>
      {children}
    </WebsiteNavContext.Provider>
  );
}

/** The real site nav, or null when rendered outside a provider. */
export function useWebsiteNav(): ResolvedNavLink[] | null {
  return useContext(WebsiteNavContext);
}
