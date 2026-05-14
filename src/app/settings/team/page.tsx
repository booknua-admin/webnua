import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';

export default function AdminSettingsTeamPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Team" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle="Manage your team, who they can access, and what they're allowed to do across your clients."
        items={adminSettingsNav}
      >
        <SettingsTabPlaceholder tab="Team" />
      </SettingsShell>
    </>
  );
}
