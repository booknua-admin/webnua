'use client';

// =============================================================================
// DataHydrationProvider — mounts on auth change and hydrates all in-memory
// stores from Supabase in the correct order:
//
//   1. hydrateClients()           — must run first (slug↔UUID translation)
//   2. All other stores in parallel (they depend on the clients map).
//
// Renders children immediately; stores hydrate asynchronously. The pre-
// hydration fallback (seeds / empty arrays) keeps consumers functional until
// the first hydration completes.
// =============================================================================

import { type ReactNode, useEffect } from 'react';

import { supabase } from '@/lib/supabase/client';
import { hydrateClients } from '@/lib/clients/clients-store';
import { hydrateAgencyPolicy } from '@/lib/agency/agency-policy-stub';
import { hydrateOverrides } from '@/lib/agency/override-stub';
import { hydratePlanCatalog } from '@/lib/billing/plan-catalog-stub';
import { hydratePlanAssignments } from '@/lib/billing/plan-assignment-stub';
import { hydrateSeatLimitHistory } from '@/lib/clients/seat-limit-stub';
import { hydrateRoster } from '@/lib/auth/roster-store';
import { hydrateClientInvites } from '@/lib/invites/client-invite-stub';
import { hydrateTeamInvites } from '@/lib/team/team-invite-stub';

async function hydrateAll() {
  // Step 1 — clients first (slug↔UUID translation required by all other stores).
  await hydrateClients();

  // Step 2 — everything else in parallel.
  await Promise.all([
    hydrateAgencyPolicy(),
    hydrateOverrides(),
    hydratePlanCatalog(),
    hydratePlanAssignments(),
    hydrateSeatLimitHistory(),
    hydrateRoster(),
    hydrateClientInvites(),
    hydrateTeamInvites(),
  ]);
}

export function DataHydrationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Hydrate ONLY when there is an authenticated session. The store tables
    // are RLS-scoped to authenticated users, so hydrating with no session
    // (a logged-out app page, or a public client site rendered on
    // {slug}.webnua.dev) just produces a wall of 401s. `onAuthStateChange`
    // delivers the session on load via INITIAL_SESSION and again on SIGNED_IN.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void hydrateAll();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
