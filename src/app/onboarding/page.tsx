'use client';

// =============================================================================
// /onboarding — Pattern B onboarding wizard entry route.
//
// Lifecycle gating (mirrors the brief + the dashboard's redirect):
//
//   pending_verification → bounce to /sign-up/check-your-email (no
//                          workspace to wizard against until verified)
//   preview AND wizard_completed_at IS NULL → render the wizard
//   preview AND wizard_completed_at IS NOT NULL → bounce to /dashboard
//   active / cancelled / etc. → bounce to /dashboard
//   operator role → bounce to /dashboard (operators use concierge surface)
//
// Resume: WizardShell reads the persisted wizard_state from the GET route
// and lands the customer at `current_step` (defaults 1 on a fresh start).
// =============================================================================

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useRole, useUser } from '@/lib/auth/user-stub';
import {
  dashboardIsInPreOnboarding,
} from '@/lib/auth/lifecycle';
import { getClientUuidBySlug, useAdminClients } from '@/lib/clients/clients-store';
import { supabase } from '@/lib/supabase/client';
import type { WizardState } from '@/lib/onboarding/types';

import { WizardShell } from './_wizard-shell';

type LoadState =
  | { kind: 'resolving' }
  | {
      kind: 'ready';
      clientId: string;
      clientSlug: string;
      businessName: string;
      email: string;
      industry: string;
      initialState: WizardState | null;
    };

export default function OnboardingPage() {
  const router = useRouter();
  const { role } = useRole();
  const user = useUser();
  const clients = useAdminClients();
  const [load, setLoad] = useState<LoadState>({ kind: 'resolving' });

  useEffect(() => {
    // Operators never see the wizard — concierge close uses the dashboard's
    // IntegrationOnboarding surface. Bounce. (No setState; the route change
    // is the signal — `react-hooks/set-state-in-effect` lint rule.)
    if (role === 'admin') {
      router.replace('/dashboard');
      return;
    }

    if (!user || !user.clientId) {
      router.replace('/dashboard');
      return;
    }

    const activeClient = clients.find((c) => c.id === user.clientId);
    if (!activeClient) {
      // Roster hasn't hydrated yet OR the user's client is missing — stay
      // in resolving; the useAdminClients subscription will re-run this
      // effect when the cache lands.
      return;
    }

    // Pending verification, post-onboarding, or any non-pre-onboarding
    // lifecycle → bounce to dashboard. The dashboard is the right home for
    // every lifecycle except active wizarding.
    if (
      activeClient.lifecycleStatus === 'pending_verification' ||
      !dashboardIsInPreOnboarding(activeClient.lifecycleStatus)
    ) {
      router.replace('/dashboard');
      return;
    }

    // Resolve UUID + load the persisted wizard state.
    const uuid = getClientUuidBySlug(activeClient.id);
    if (!uuid) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/clients/${uuid}/wizard-state`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (cancelled) return;
      if (res.ok) {
        const body = (await res.json()) as { completed?: boolean; state?: WizardState | null };
        if (body.completed) {
          // Already-completed wizard → bounce. Route change unmounts; no
          // setState.
          router.replace('/dashboard');
          return;
        }
        const { data: clientRow } = await supabase
          .from('clients')
          .select('name, primary_contact_email, industry')
          .eq('id', uuid)
          .maybeSingle();
        const row = clientRow as
          | { name: string; primary_contact_email: string | null; industry: string }
          | null;
        setLoad({
          kind: 'ready',
          clientId: uuid,
          clientSlug: activeClient.id,
          businessName: row?.name ?? activeClient.name,
          email: row?.primary_contact_email ?? user.email ?? '',
          industry: row?.industry ?? '',
          initialState: body.state ?? null,
        });
      } else {
        router.replace('/dashboard');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, user, clients, router]);

  if (load.kind === 'resolving') {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink-quiet">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <WizardShell
      clientId={load.clientId}
      clientSlug={load.clientSlug}
      fallbackBusinessName={load.businessName}
      fallbackEmail={load.email}
      fallbackIndustry={load.industry}
      initialState={load.initialState}
    />
  );
}
