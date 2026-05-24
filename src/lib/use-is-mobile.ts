'use client';

import { useEffect, useState } from 'react';

// =============================================================================
// useIsMobile — `true` when the viewport is below the `md` breakpoint (768px).
//
// Used sparingly — most responsive work lives in Tailwind `md:` classes, which
// don't need JS. Reach for this only when behaviour (not styling) must branch
// on viewport — currently just the calendar's "default to day-view on mobile"
// path.
//
// SSR-safe: the first render reports `false` so server + client agree, then
// the effect flips it on mount if needed. Listens for resize so the auto-
// switch fires when a tablet rotates into a phone-width column.
// =============================================================================

const MOBILE_BREAKPOINT_PX = 768;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return isMobile;
}

export { useIsMobile };
