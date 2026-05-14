import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';

export default function ClientSettingsNotificationsPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Notifications" />} />
      <SettingsShell
        eyebrow="Voltline · your account"
        title={
          <>
            Your <em>settings</em>.
          </>
        }
        subtitle={
          <>
            When and how Webnua tells you about leads, bookings, reviews, and alerts.{' '}
            <strong>SMS hits fast, email is good for end-of-day.</strong>
          </>
        }
        items={clientSettingsNav}
      >
        <SettingsTabPlaceholder tab="Notifications" />
      </SettingsShell>
    </>
  );
}
