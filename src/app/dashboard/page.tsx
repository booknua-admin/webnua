'use client';

import { IntegrationOnboarding } from '@/components/shared/onboarding/IntegrationOnboarding';
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

  // A client still in the `onboarding` lifecycle gets the integration
  // onboarding flow instead of a dashboard of zeros — for the client and for
  // an operator drilled into that sub-account.
  if (activeClient?.status === 'setup') {
    return (
      <IntegrationOnboarding
        clientName={activeClient.name}
        clientSlug={activeClient.id}
        isOperator={role === 'admin'}
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
