import { SecurityRow } from '@/components/shared/settings/SecurityRow';
import { SessionRow } from '@/components/shared/settings/SessionRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { SignOutOtherSessionsButton } from '@/components/shared/settings/SignOutOtherSessionsButton';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  clientSecurityCredentials,
  clientSecuritySessions,
  clientSecurityTwoFactor,
} from '@/lib/settings/client-security';

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
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Login <em>credentials</em>
              </>
            }
            description="Your email is the login. Password requirements: 12+ characters, mix of cases and numbers."
          >
            {clientSecurityCredentials.map((row) => (
              <SecurityRow
                key={row.id}
                heading={row.heading}
                status={row.status}
                description={row.description}
                action={row.action}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Two-factor <em>authentication</em>
              </>
            }
            description="Extra layer of protection for your account."
          >
            {clientSecurityTwoFactor.map((row) => (
              <SecurityRow
                key={row.id}
                heading={row.heading}
                status={row.status}
                description={row.description}
                action={row.action}
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Active <em>sessions</em>
              </>
            }
            description={
              <>
                Where you&apos;re currently signed in.{' '}
                <strong>If you don&apos;t recognise one, revoke it immediately</strong> and change
                your password.
              </>
            }
          >
            {clientSecuritySessions.map((session) => (
              <SessionRow
                key={session.id}
                icon={session.icon}
                device={session.device}
                isCurrent={session.isCurrent}
                meta={session.meta}
                when={session.when}
              />
            ))}
            <div className="mt-3.5">
              <SignOutOtherSessionsButton />
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
