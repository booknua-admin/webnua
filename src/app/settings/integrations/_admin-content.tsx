'use client';

// The operator's /settings/integrations branch. Dispatches on workspace mode
// (Cluster 8 · Session 4b): agency mode → the cross-client integration matrix
// (the primary place an operator manages client integrations) plus the
// workspace-level connected + available services; sub-account mode → the
// per-client integration policy (which providers this client inherits from the
// agency vs overrides).

import { SubAccountIntegrationsContent } from './_sub-account-content';
import { IntegrationMatrix } from '@/components/admin/integrations/IntegrationMatrix';
import { IntegrationMatrixActionCard } from '@/components/admin/integrations/IntegrationMatrixActionCard';
import { IntegrationMatrixHero } from '@/components/admin/integrations/IntegrationMatrixHero';
import { IntegrationCard } from '@/components/shared/settings/IntegrationCard';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  adminMatrixAttention,
  adminMatrixColumns,
  adminMatrixFilters,
  adminMatrixGaps,
  adminMatrixHero,
  adminMatrixRows,
} from '@/lib/integrations/admin-matrix';
import {
  adminAvailableIntegrations,
  adminConnectedIntegrations,
} from '@/lib/settings/admin-integrations';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export function AdminIntegrationsContent() {
  const { activeClient } = useWorkspace();

  if (activeClient) {
    return (
      <SubAccountIntegrationsContent
        clientId={activeClient.id}
        clientName={activeClient.name}
      />
    );
  }

  return <AgencyIntegrationsView />;
}

function AgencyIntegrationsView() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Integrations" />} />
      <SettingsShell
        eyebrow="Agency · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle="Every client's connection status in one view, plus the services connected at the workspace level. Health status visible at a glance."
      >
        <div className="flex flex-col gap-7">
          <IntegrationMatrixHero
            tag={adminMatrixHero.tag}
            title={adminMatrixHero.title}
            subtitle={adminMatrixHero.subtitle}
            stats={adminMatrixHero.stats}
          />

          <IntegrationMatrix
            title={
              <>
                Integration <em>matrix</em> · {adminMatrixRows.length} clients ×{' '}
                {adminMatrixColumns.length} integrations
              </>
            }
            filters={adminMatrixFilters}
            activeFilter="all"
            columns={adminMatrixColumns}
            rows={adminMatrixRows}
          />

          <div className="grid grid-cols-2 gap-3.5">
            <IntegrationMatrixActionCard
              tone="attention"
              heading="Needs your attention"
              badge={{ label: String(adminMatrixAttention.length), tone: 'warn' }}
              description={
                <>
                  Token expired or connection broken.{' '}
                  <strong>Trigger a reauth request to the client</strong> — they&apos;ll get a
                  notification.
                </>
              }
              items={adminMatrixAttention}
            />
            <IntegrationMatrixActionCard
              heading="Critical gaps"
              badge={{ label: String(adminMatrixGaps.length), tone: 'info' }}
              description={
                <>
                  Missing integrations that block a service from working.{' '}
                  <strong>Send a setup nudge</strong> with a one-click connect link.
                </>
              }
              items={adminMatrixGaps}
            />
          </div>

          <SettingsPanel>
            <SettingsSection
              heading={
                <>
                  Connected <em>services</em>
                </>
              }
              description={
                <>
                  6 services connected.{' '}
                  <strong>Each integration is a maintenance commitment</strong> — Webnua adds them
                  sparingly. Click any card to manage credentials or reauthorize.
                </>
              }
            >
              <div className="flex flex-col gap-2.5">
                {adminConnectedIntegrations.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    status={item.status}
                    statusLabel={item.statusLabel}
                    logo={item.logo}
                    meta={item.meta}
                    action={item.action}
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              heading={
                <>
                  Available <em>integrations</em>
                </>
              }
              description="Other services Webnua supports but you haven't connected yet. Click to start the connect flow."
            >
              <div className="flex flex-col gap-2.5">
                {adminAvailableIntegrations.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    name={item.name}
                    description={item.description}
                    status={item.status}
                    statusLabel={item.statusLabel}
                    logo={item.logo}
                    meta={item.meta}
                    action={item.action}
                  />
                ))}
              </div>
            </SettingsSection>
          </SettingsPanel>
        </div>
      </SettingsShell>
    </>
  );
}
