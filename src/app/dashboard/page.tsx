'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { BillingSuspendedScreen } from '@/components/shared/BillingSuspendedScreen';
import { CancellationBanner } from '@/components/shared/CancellationBanner';
import { IntegrationOnboarding } from '@/components/shared/onboarding/IntegrationOnboarding';
import type { BillingGateResponse } from '@/app/api/clients/[id]/billing-gate/route';
import {
  dashboardIsInPreOnboarding,
  isCancelled,
  isSoftDeleted,
} from '@/lib/auth/lifecycle';
import { useRole, useUser } from '@/lib/auth/user-stub';
import { getClientUuidBySlug, useAdminClients } from '@/lib/clients/clients-store';
import { useIsAgencyMode, useWorkspace } from '@/lib/workspace/workspace-stub';

import { AdminDashboardContent } from './_admin-content';
import { ClientDashboardContent } from './_client-content';
import { ClientHubContent } from './_hub-content';

export default function DashboardPage() {
  const router = useRouter();
  const { role } = useRole();
  const user = useUser();
  const isAgencyMode = useIsAgencyMode();
  const workspace = useWorkspace();
  const clients = useAdminClients();

  // The client whose workspace this dashboard renders: a client sees their
  // own; an operator in sub-account mode sees the drilled-into client.
  const activeSlug =
    role === 'admin' ? workspace.activeClientId : (user?.clientId ?? null);
  const activeClient = activeSlug
    ? (clients.find((c) => c.id === activeSlug) ?? null)
    : null;

  // Pattern B onboarding gate: when a client-role user is in 'preview' and
  // hasn't completed the wizard, redirect them to /onboarding. The wizard
  // is the explicit step 1 of Pattern B. We only redirect for clients —
  // operators drilled in see the operator IntegrationOnboarding surface
  // (with the manual "Mark active" affordance) which is the right tool
  // for concierge close.
  //
  // We have to async-check `clients.wizard_completed_at` because the
  // clients-store doesn't carry it (column added in migration 0091, not
  // worth a store-wide field for one redirect). The check fires once on
  // mount per (role, activeSlug) and caches the result. While the check
  // is in-flight we render the current IntegrationOnboarding (no flash of
  // wrong UI; the moment the check returns we redirect or stay).
  const shouldOnboard =
    role === 'client' &&
    activeClient !== null &&
    dashboardIsInPreOnboarding(activeClient.lifecycleStatus);

  // The wizard-completion check is async (no client-store column for
  // wizard_completed_at). While the check is in-flight we render `null`
  // rather than IntegrationOnboarding; the moment the check resolves we
  // either redirect to /onboarding OR flip `wizardCheckedAt` so the
  // rendered surface unblocks. We track the resolution via a non-null
  // timestamp so the React-Hooks "no sync setState in effect" rule
  // (every setState call below sits AFTER an `await`) is satisfied.
  const [wizardCheckedAt, setWizardCheckedAt] = useState<number | null>(null);
  const wizardCompletionResolved = !shouldOnboard || wizardCheckedAt !== null;

  useEffect(() => {
    if (!shouldOnboard || !user?.clientId) return;
    let cancelled = false;
    async function check() {
      const uuid = getClientUuidBySlug(user!.clientId!);
      if (!uuid) {
        // Roster not hydrated yet — wait for the next render with the
        // clients-store subscription re-firing the effect.
        return;
      }
      const res = await fetch(`/api/clients/${uuid}/wizard-state`, {
        method: 'GET',
        credentials: 'include',
      });
      if (cancelled) return;
      if (res.ok) {
        const body = (await res.json()) as { completed?: boolean };
        if (body.completed === false) {
          router.replace('/onboarding');
          return; // route change unmounts; no setState needed
        }
      }
      // Either completed === true OR the route 404'd / errored — let
      // IntegrationOnboarding mount and surface what's there.
      setWizardCheckedAt(Date.now());
    }
    void check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldOnboard, user?.clientId, router]);

  // Billing-gate check — fires `/api/clients/[id]/billing-gate` for any
  // active client past pre-onboarding. When `gated === true` we render
  // <BillingSuspendedScreen /> in place of the regular dashboard. The
  // gate IS the consumption layer for `shouldGateClientAccess()` in
  // `lib/integrations/stripe/billing-status.ts` — without this the
  // helper exists but does nothing.
  //
  // We skip the fetch for cancelled/deleted lifecycle states (already
  // handled by the lifecycle dispatch above) and for pre-onboarding
  // (no Stripe customer row yet → gate would return false anyway).
  const shouldCheckBillingGate =
    activeClient !== null &&
    !dashboardIsInPreOnboarding(activeClient.lifecycleStatus) &&
    !isCancelled(activeClient.lifecycleStatus) &&
    !isSoftDeleted(activeClient.lifecycleStatus);
  const [billingGate, setBillingGate] = useState<BillingGateResponse | null>(
    null,
  );
  useEffect(() => {
    if (!shouldCheckBillingGate || !activeClient) return;
    let cancelled = false;
    async function check() {
      const uuid = getClientUuidBySlug(activeClient!.id);
      if (!uuid) return; // wait for clients-store hydration
      const res = await fetch(`/api/clients/${uuid}/billing-gate`, {
        method: 'GET',
        credentials: 'include',
      });
      if (cancelled) return;
      if (!res.ok) {
        // 401/403/5xx — fail-open. A billing-gate API failure must not
        // lock the customer out of their dashboard; the gate is a
        // belt-and-braces enforcement of Stripe's source-of-truth.
        setBillingGate({ gated: false });
        return;
      }
      const body = (await res.json()) as BillingGateResponse;
      setBillingGate(body);
    }
    void check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldCheckBillingGate, activeClient?.id]);

  // Cancellation Stage 2 ('deleted') — the customer should not have reached
  // here (dashboardIsAccessible returns false), but if they did via a stale
  // session, redirect them off and let the auth layer handle the lock-out.
  if (activeClient && isSoftDeleted(activeClient.lifecycleStatus)) {
    // Lazy redirect — replace not push so they can't back-button into here.
    if (typeof window !== 'undefined') {
      router.replace('/(auth)/login?from=deleted');
    }
    return null;
  }

  // Cancellation Stage 1 ('cancelled') — render the regular dashboard with
  // a high-visibility banner on top + a reactivate CTA. The customer can
  // still see (read-only-ish) what's in their workspace, so they understand
  // what reactivating would restore. The banner self-fetches the
  // cancellation timestamps.
  if (activeClient && isCancelled(activeClient.lifecycleStatus)) {
    const clientUuid = getClientUuidBySlug(activeClient.id);
    return (
      <>
        {clientUuid ? (
          <div className="px-4 pt-4 md:px-10 md:pt-10">
            <CancellationBanner clientId={clientUuid} clientName={activeClient.name} />
          </div>
        ) : null}
        {role === 'admin' ? (
          isAgencyMode ? <AdminDashboardContent /> : <ClientHubContent />
        ) : (
          <ClientDashboardContent />
        )}
      </>
    );
  }

  // Pattern B onboarding wizard gate: a client in pre-onboarding lifecycle
  // who hasn't completed the wizard yet gets redirected (above). Once the
  // wizard is done, fall through to the regular IntegrationOnboarding
  // (which surfaces the publish CTA + integration cards + custom domain).
  if (
    activeClient &&
    dashboardIsInPreOnboarding(activeClient.lifecycleStatus) &&
    wizardCompletionResolved
  ) {
    return (
      <IntegrationOnboarding
        clientName={activeClient.name}
        clientSlug={activeClient.id}
        isOperator={role === 'admin'}
        lifecycleStatus={activeClient.lifecycleStatus}
      />
    );
  }

  // In-flight wizard check — render nothing rather than flash the wrong
  // screen. The redirect lands within ~1 round-trip.
  if (activeClient && dashboardIsInPreOnboarding(activeClient.lifecycleStatus)) {
    return null;
  }

  // Billing gate — Stripe past_due past the 7-day grace OR cancelled-state
  // we didn't catch via lifecycle (race). We block rendering the dashboard
  // entirely behind the suspended screen. Operators-in-sub-account see it
  // too — useful concierge signal that the customer's account is paused.
  if (
    shouldCheckBillingGate &&
    billingGate?.gated &&
    billingGate.reason &&
    activeClient
  ) {
    const uuid = getClientUuidBySlug(activeClient.id);
    if (uuid) {
      return (
        <BillingSuspendedScreen
          clientId={uuid}
          clientName={activeClient.name}
          reason={billingGate.reason}
        />
      );
    }
  }

  if (role === 'admin') {
    // Workspace context dispatch: agency mode → the cross-client roster;
    // sub-account mode → the single-client overview hub.
    return isAgencyMode ? <AdminDashboardContent /> : <ClientHubContent />;
  }

  return <ClientDashboardContent />;
}
