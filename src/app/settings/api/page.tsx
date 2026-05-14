import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminSettingsNav } from '@/lib/nav/admin-settings-nav';

export default function AdminSettingsApiPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="API + webhooks" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            API keys and webhook endpoints for advanced integrations.{' '}
            <strong>Most operators won&apos;t need this</strong> — only used if you&apos;re piping
            data into third-party CRMs or building custom workflows.
          </>
        }
        items={adminSettingsNav}
      >
        <SettingsTabPlaceholder tab="API + webhooks" />
      </SettingsShell>
    </>
  );
}
