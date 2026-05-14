import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SettingsTabPlaceholder } from '@/components/shared/settings/SettingsTabPlaceholder';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';

export default function ClientSettingsSecurityPage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Login + security" />} />
      <SettingsShell
        eyebrow="Voltline · your account"
        title={
          <>
            Your <em>settings</em>.
          </>
        }
        subtitle={
          <>
            Password, 2FA, and where you&apos;re signed in.{' '}
            <strong>Two-factor auth is recommended</strong> since this account controls leads,
            bookings, and customer data.
          </>
        }
        items={clientSettingsNav}
      >
        <SettingsTabPlaceholder tab="Login + security" />
      </SettingsShell>
    </>
  );
}
