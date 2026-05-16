'use client';

import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminDashboardContent } from './_admin-content';
import { ClientDashboardContent } from './_client-content';
import { ClientHubContent } from './_hub-content';

export default function DashboardPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    // Workspace context dispatch: agency mode → the cross-client roster;
    // sub-account mode → the single-client overview hub.
    return isAgencyMode ? <AdminDashboardContent /> : <ClientHubContent />;
  }

  return <ClientDashboardContent />;
}
