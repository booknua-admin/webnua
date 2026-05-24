'use client';

// =============================================================================
// TanStack Query — the data-fetching spine (CLAUDE.md stack · Phase 3).
//
// One QueryClient per browser tab, held in component state so it survives
// re-renders but is never shared across requests. Failures surface as the
// platform `AppError` — data-access `queryFn`s throw it; React Query catches
// it into a typed `error` (see `src/lib/errors.ts`).
//
// Realtime lives in `RealtimeProvider` (Phase 9) — one RLS-scoped channel
// that invalidates query keys on postgres_changes; not here.
// =============================================================================

import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from './getQueryClient';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Singleton on the browser (memoised in getQueryClient); fresh per request
  // on the server. Module-level callers reach the same client via
  // getQueryClient() so writes outside React (e.g. brand-style mutations)
  // can update the cache.
  const client = getQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
