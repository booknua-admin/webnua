import { DangerRow } from '@/components/shared/settings/DangerRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';
import { adminDangerClient, adminDangerWorkspace } from '@/lib/settings/admin-danger';

export default function AdminSettingsDangerPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Danger zone" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            Destructive actions. <strong>All of these require typed confirmation</strong> and most
            can&apos;t be undone. Owner role only.
          </>
        }
        items={adminSettingsNav}
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Workspace <em>destruction</em>
              </>
            }
            description="Permanent operations that affect your entire Webnua Perth workspace."
          >
            {adminDangerWorkspace.map((entry) => (
              <DangerRow
                key={entry.id}
                heading={entry.heading}
                description={entry.description}
                action={entry.action}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Client <em>removal</em>
              </>
            }
            description="Remove individual clients from your workspace. Their data is exported automatically before deletion."
          >
            {adminDangerClient.map((entry) => (
              <DangerRow
                key={entry.id}
                heading={entry.heading}
                description={entry.description}
                action={entry.action}
              />
            ))}
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
