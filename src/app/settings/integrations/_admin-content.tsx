import { IntegrationCard } from '@/components/shared/settings/IntegrationCard';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  adminAvailableIntegrations,
  adminConnectedIntegrations,
} from '@/lib/settings/admin-integrations';

export function AdminIntegrationsContent() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Integrations" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle="Connected services and integrations across your workspace. Health status visible at a glance."
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Connected <em>services</em>
              </>
            }
            description={
              <>
                6 services connected. <strong>Each integration is a maintenance commitment</strong>{' '}
                — Webnua adds them sparingly. Click any card to manage credentials or reauthorize.
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
      </SettingsShell>
    </>
  );
}
