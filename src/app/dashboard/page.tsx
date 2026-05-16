'use client';

import { PagePlaceholder } from '@/components/shared/PagePlaceholder';
import { useRole } from '@/lib/auth/user-stub';
import { useIsAgencyMode } from '@/lib/workspace/workspace-stub';

import { AdminDashboardContent } from './_admin-content';
import { ClientDashboardContent } from './_client-content';

export default function DashboardPage() {
  const { role } = useRole();
  const isAgencyMode = useIsAgencyMode();

  if (role === 'admin') {
    // Workspace context dispatch: agency mode → the cross-client roster;
    // sub-account mode → the single-client overview hub. The hub itself is
    // wired in Cluster 6 · Session 1b — this placeholder holds its slot.
    return isAgencyMode ? (
      <AdminDashboardContent />
    ) : (
      <PagePlaceholder
        eyebrow="SINGLE-CLIENT HUB"
        title="Client overview"
        description="The single-client overview hub assembles here in sub-account mode. Wiring lands in Session 1b."
      />
    );
  }

  return <ClientDashboardContent />;
}
