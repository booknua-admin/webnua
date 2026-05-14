import { Card, CardContent } from '@/components/ui/card';
import { IntegrationCard } from '@/components/shared/settings/IntegrationCard';
import { SettingsFieldRow } from '@/components/shared/settings/SettingsFieldRow';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';
import { adminConnectedIntegrations } from '@/lib/settings/admin-integrations';
import { adminWorkspaceFields, adminWorkspacePlanFields } from '@/lib/settings/admin-workspace';

export default function AdminSettingsWorkspacePage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Workspace" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            Workspace-level settings for Webnua Perth.{' '}
            <strong>Team, integrations, billing, defaults.</strong> Most of this you set once and
            forget.
          </>
        }
        items={adminSettingsNav}
      >
        <Card className="py-7">
          <CardContent className="px-8">
            <SettingsSection
              heading="Workspace"
              description="The container for everything in your Perth operation. Separate from Webnua Dublin."
            >
              {adminWorkspaceFields.map((field) => (
                <SettingsFieldRow
                  key={field.label}
                  label={field.label}
                  sub={field.sub}
                  value={
                    field.mono ? <span className="font-mono">{field.value}</span> : field.value
                  }
                />
              ))}
            </SettingsSection>

            <SettingsSection
              heading="Integrations"
              description="Connected services that power the platform. We add integrations sparingly — every one is a maintenance commitment."
            >
              <div className="flex flex-col gap-2.5">
                {adminConnectedIntegrations.slice(0, 6).map((item) => (
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
              heading="Plan + usage"
              description="Webnua Perth is on the operator plan. Pricing scales with active clients, not features."
            >
              {adminWorkspacePlanFields.map((field) => (
                <SettingsFieldRow
                  key={field.label}
                  label={field.label}
                  sub={field.sub}
                  value={field.value}
                />
              ))}
            </SettingsSection>
          </CardContent>
        </Card>
      </SettingsShell>
    </>
  );
}
