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
import { getClientUuidBySlug, useAdminClients } from '@/lib/clients/clients-store';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export function AdminDomainsContent() {
  const { activeClient } = useWorkspace();
  // Subscribe to the clients-store so the slug→UUID resolution re-runs once
  // the cache hydrates. `AdminClient.id` is the slug (per clients-store.ts
  // line 55); the table FK is the UUID, so we resolve here at the boundary.
  useAdminClients();

  if (activeClient) {
    const clientUuid = getClientUuidBySlug(activeClient.id);
    if (!clientUuid) {
      // Clients-store is still hydrating — render a slim placeholder.
      return (
        <div className="px-10 py-9 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
          {'// Loading…'}
        </div>
      );
    }
    return (
      <SubAccountDomainsContent clientId={clientUuid} clientName={activeClient.name} />
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
