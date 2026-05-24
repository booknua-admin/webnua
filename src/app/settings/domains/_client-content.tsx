'use client';

// =============================================================================
// /settings/domains — client-role view.
//
// Phase 9 custom-domain attachment. The signed-in client's own custom-domain
// management: add a domain, watch status, set primary, remove.
// =============================================================================

import { CustomDomainSection } from '@/components/shared/settings/CustomDomainSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useUser } from '@/lib/auth/user-stub';
import { getAdminClients } from '@/lib/clients/clients-store';

export function ClientDomainsContent() {
  const user = useUser();
  const clientId = user?.clientId ?? null;
  const ownClient = clientId ? getAdminClients().find((c) => c.id === clientId) : null;
  const clientName = ownClient?.name ?? 'your business';
  const conciergeUrl =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WEBNUA_CONCIERGE_CALENDAR_URL
      ? process.env.NEXT_PUBLIC_WEBNUA_CONCIERGE_CALENDAR_URL
      : null;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Domains" />} />
      <SettingsShell
        eyebrow="Account"
        title={
          <>
            Custom <em>domain</em>.
          </>
        }
        subtitle="Connect your own domain. After you add the DNS records at your provider, the connection goes live within an hour."
      >
        <CustomDomainSection
          clientId={clientId}
          clientName={clientName}
          conciergeCalendarUrl={conciergeUrl}
        />
      </SettingsShell>
    </>
  );
}
