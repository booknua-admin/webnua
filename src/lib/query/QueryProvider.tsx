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

import { useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { isAppError } from '@/lib/errors';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // An `auth`/`forbidden`/`not_found` AppError will never succeed on
        // retry — only retry the genuinely-transient `unexpected` kind, once.
        retry: (failureCount, error) => {
          if (isAppError(error) && error.kind !== 'unexpected') return false;
          return failureCount < 1;
        },
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
