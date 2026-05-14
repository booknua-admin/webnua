import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';

export default function AdminSettingsDefaultsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Defaults" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            Workspace-wide defaults applied to new clients.{' '}
            <strong>Set once, applied to every new onboarding.</strong> Per-client overrides are
            still possible.
          </>
        }
        items={adminSettingsNav}
      >
        <SettingsTabPlaceholder tab="Defaults" />
      </SettingsShell>
    </>
  );
}
