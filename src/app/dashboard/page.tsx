'use client';

import { IntegrationOnboarding } from '@/components/shared/onboarding/IntegrationOnboarding';
import { dashboardIsInPreOnboarding } from '@/lib/auth/lifecycle';
import { useRole, useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';
import { useIsAgencyMode, useWorkspace } from '@/lib/workspace/workspace-stub';

import { AdminDashboardContent } from './_admin-content';
import { ClientDashboardContent } from './_client-content';
import { ClientHubContent } from './_hub-content';

export default function DashboardPage() {
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

  // Pattern B: a client in pending_verification / preview / legacy onboarding
  // lifecycle gets the IntegrationOnboarding wizard surface (with the
  // "Publish to go live" CTA when their site has been generated). The
  // dispatch goes through `dashboardIsInPreOnboarding` so the lifecycle
  // helper is the SoT for which states are "pre-published". `activeClient.
  // status` is the legacy two-value field ('setup' | 'active') from
  // clients-store; the helper reads the live lifecycle_status indirectly via
  // a new prop wired into AdminClient.
  if (activeClient && dashboardIsInPreOnboarding(activeClient.lifecycleStatus)) {
    return (
      <IntegrationOnboarding
        clientName={activeClient.name}
        clientSlug={activeClient.id}
        isOperator={role === 'admin'}
        lifecycleStatus={activeClient.lifecycleStatus}
      />
    );
  }

  if (role === 'admin') {
    // Workspace context dispatch: agency mode → the cross-client roster;
    // sub-account mode → the single-client overview hub.
    return isAgencyMode ? <AdminDashboardContent /> : <ClientHubContent />;
  }

  return <ClientDashboardContent />;
}
