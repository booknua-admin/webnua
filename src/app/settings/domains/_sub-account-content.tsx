'use client';

// =============================================================================
// /settings/domains — operator + sub-account view.
//
// Phase 9 — the operator drilled into one client sees the same UI the client
// would see (CustomDomainSection). The operator-only path (attach on the
// client's behalf for concierge installs) flows through the same form; the
// API authorises operators-on-accessible-clients separately.
// =============================================================================

import { CustomDomainSection } from '@/components/shared/settings/CustomDomainSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';

export function SubAccountDomainsContent({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const conciergeUrl =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WEBNUA_CONCIERGE_CALENDAR_URL
      ? process.env.NEXT_PUBLIC_WEBNUA_CONCIERGE_CALENDAR_URL
      : null;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings', clientName]} current="Domains" />} />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Custom <em>domain</em>.
          </>
        }
        subtitle={`Attach a domain on ${clientName}'s behalf. After DNS records are set at their registrar, the connection goes live within an hour.`}
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
