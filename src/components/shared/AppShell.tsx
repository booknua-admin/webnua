'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

// =============================================================================
// AppShell — top-level grid for every authed route.
//
// Desktop (≥md, 768px): fixed 280px sidebar + flexible main column. The
// long-standing layout, unchanged.
//
// Mobile (<md): sidebar hides off-canvas; a hamburger button in the Topbar
// toggles a slide-in overlay drawer. Backdrop click + route change dismiss.
// Body scroll is locked while open. The drawer renders the exact same
// `sidebar` content the desktop layout uses — there is no parallel mobile
// nav implementation.
// =============================================================================

type MobileNavContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

/** Hook for any component that needs to drive the mobile drawer (the Topbar
 *  hamburger is the only consumer today). Returns `null` outside an AppShell
 *  so non-shell surfaces (the auth screens) can safely call it. */
function useMobileNav(): MobileNavContextValue | null {
  return useContext(MobileNavContext);
}

type AppShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

function AppShell({ sidebar, children, className }: AppShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Dismiss on route change — the drawer is for navigation, so navigating
  // away should close it. usePathname changes per navigation.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Body scroll lock while the drawer is open. Applies on mobile (where the
  // drawer can actually open); on desktop the drawer is never open.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Auto-close on resize into desktop so the open-on-mobile state doesn't
  // linger as a phantom overlay when the user rotates / resizes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Escape key closes the drawer (keyboard-accessible).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <MobileNavContext.Provider value={{ isOpen, open, close, toggle }}>
      <div
        data-slot="app-shell"
        className={cn(
          'grid min-h-svh w-full grid-cols-1 bg-paper md:grid-cols-[280px_1fr]',
          className,
        )}
      >
        {/* Mobile backdrop. Sits between content and drawer; click dismisses. */}
        <div
          aria-hidden={!isOpen}
          onClick={close}
          className={cn(
            'fixed inset-0 z-40 bg-ink/60 transition-opacity duration-200 md:hidden',
            isOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0',
          )}
        />

        {/* Sidebar host. On mobile: fixed-position off-canvas, slides in via
         *  transform. On desktop: takes its grid cell, sidebar's own
         *  `sticky top-0` keeps it visible on scroll. */}
        <div
          data-slot="app-shell-sidebar"
          data-open={isOpen || undefined}
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-[280px] max-w-[80vw] transform transition-transform duration-200 ease-out md:static md:z-auto md:max-w-none md:transform-none md:transition-none',
            isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          )}
          role="navigation"
          aria-label="Primary"
        >
          {sidebar}
        </div>

        <main className="flex min-w-0 flex-col">{children}</main>
      </div>
    </MobileNavContext.Provider>
  );
}

export { AppShell, useMobileNav };
