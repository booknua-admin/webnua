// =============================================================================
// getQueryClient — singleton accessor for the TanStack QueryClient.
//
// Pattern from TanStack's own Next.js App Router docs:
//   - Server: a fresh client per request (so SSR fetches don't bleed between
//     requests).
//   - Browser: one client per tab, memoised on the module — survives every
//     re-render and is reachable from non-hook code (the brand-style write
//     path needs cache access from a fire-and-forget mutation).
//
// QueryProvider consumes this so the React tree and module-level callers
// share the same client.
// =============================================================================

import { QueryClient } from '@tanstack/react-query';

import { isAppError } from '@/lib/errors';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Auth / forbidden / not_found AppErrors will never succeed on retry
        // — only retry the genuinely-transient `unexpected` kind, once.
        retry: (failureCount, error) => {
          if (isAppError(error) && error.kind !== 'unexpected') return false;
          return failureCount < 1;
        },
      },
    },
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: a fresh client per request.
    return makeQueryClient();
  }
  if (!browserClient) {
    browserClient = makeQueryClient();
  }
  return browserClient;
}
