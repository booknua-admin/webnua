import { SettingsFieldRow } from '@/components/shared/settings/SettingsFieldRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminWorkspaceFields, adminWorkspacePlanFields } from '@/lib/settings/admin-workspace';

export default function AdminSettingsWorkspacePage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Workspace" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Workspace <em>settings</em>.
          </>
        }
        subtitle={
          <>
            Workspace-level settings for Webnua Perth.{' '}
            <strong>Identity, plan, usage.</strong> Most of this you set once and forget.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading="Workspace"
            description="The container for everything in your Perth operation. Separate from Webnua Dublin."
          >
            {adminWorkspaceFields.map((field) => (
              <SettingsFieldRow
                key={field.label}
                label={field.label}
                sub={field.sub}
                value={field.mono ? <span className="font-mono">{field.value}</span> : field.value}
              />
            ))}
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
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
