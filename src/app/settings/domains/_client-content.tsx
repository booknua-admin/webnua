'use client';

// =============================================================================
// /settings/domains — client-role view.
//
// Phase 9 custom-domain attachment. The signed-in client's own custom-domain
// management: add a domain, watch status, set primary, remove.
//
// `useUser().clientId` resolves to the client SLUG (per CLAUDE.md auth
// model); `client_custom_domains.client_id` is the UUID, so we resolve via
// `getClientUuidBySlug` from the clients-store cache. Until that store
// hydrates, we surface a "loading" stub rather than running a query with
// the wrong column shape.
// =============================================================================

import { CustomDomainSection } from '@/components/shared/settings/CustomDomainSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useUser } from '@/lib/auth/user-stub';
import {
  getAdminClients,
  getClientUuidBySlug,
  useAdminClients,
} from '@/lib/clients/clients-store';

export function ClientDomainsContent() {
  const user = useUser();
  // Subscribe to the clients cache so we re-render once it hydrates — the
  // slug→UUID lookup is reactive against this.
  useAdminClients();

  const clientSlug = user?.clientId ?? null;
  const clientUuid = clientSlug ? getClientUuidBySlug(clientSlug) : null;
  const ownClient = clientUuid
    ? getAdminClients().find((c) => c.id === clientUuid)
    : null;
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
          clientId={clientUuid}
          clientName={clientName}
          conciergeCalendarUrl={conciergeUrl}
        />
      </SettingsShell>
    </>
  );
}
