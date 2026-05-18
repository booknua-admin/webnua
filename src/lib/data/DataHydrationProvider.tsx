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
    // Hydrate on mount.
    void hydrateAll();

    // Re-hydrate whenever the auth session changes (sign in, sign out, token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void hydrateAll();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
