'use client';

// =============================================================================
// /settings/domains — operator-role view. Dispatches internally on workspace
// mode: agency → cross-client AllDomainsTable, sub-account → the same
// CustomDomainSection the client sees, scoped to the active client.
// =============================================================================

import { SubAccountDomainsContent } from './_sub-account-content';
import { AllDomainsTable } from '@/components/admin/domains/AllDomainsTable';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export function AdminDomainsContent() {
  const { activeClient } = useWorkspace();
  if (activeClient) {
    return (
      <SubAccountDomainsContent clientId={activeClient.id} clientName={activeClient.name} />
    );
  }
  return <AgencyDomainsView />;
}

function AgencyDomainsView() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Domains" />} />
      <SettingsShell
        eyebrow="Agency · Webnua Perth"
        title={
          <>
            Client <em>domains</em>.
          </>
        }
        subtitle="Every custom domain attached across all clients — see what's live, what's pending, and what needs setup help."
      >
        <SettingsPanel>
          <AllDomainsTable />
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
