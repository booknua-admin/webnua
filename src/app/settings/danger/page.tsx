import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';

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
        <SettingsTabPlaceholder tab="Danger zone" />
      </SettingsShell>
    </>
  );
}
