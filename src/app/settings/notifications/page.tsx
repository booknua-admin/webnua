import { NotificationRow } from '@/components/shared/settings/NotificationRow';
import { SettingsFieldRow } from '@/components/shared/settings/SettingsFieldRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Switch } from '@/components/ui/switch';
import { Eyebrow } from '@/components/ui/eyebrow';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';
import { clientNotifications, clientQuietHours } from '@/lib/settings/client-notifications';

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
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Notification <em>preferences</em>
              </>
            }
            description={
              <>
                Toggle the channels for each notification type.{' '}
                <strong>Critical alerts (negative reviews, missed bookings)</strong> are always sent
                via SMS regardless of these settings.
              </>
            }
          >
            <div className="flex flex-col gap-5">
              {clientNotifications.map((group) => (
                <div key={group.label}>
                  <Eyebrow tone="quiet" className="mb-1.5 block text-[10px]">
                    {`// ${group.label.toUpperCase()}`}
                  </Eyebrow>
                  {group.rows.map((row) => (
                    <NotificationRow
                      key={row.label}
                      label={row.label}
                      sub={row.sub}
                      channels={group.channels}
                      active={row.active}
                    />
                  ))}
                </div>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Quiet <em>hours</em>
              </>
            }
            description={
              <>
                Pause non-critical SMS during these times.{' '}
                <strong>Critical alerts still come through</strong> regardless.
              </>
            }
          >
            <SettingsFieldRow
              label="Enabled"
              sub="Quiet hours active"
              value={
                <span className="flex items-center gap-2.5">
                  <Switch defaultChecked={clientQuietHours.enabled} />
                  <span>{clientQuietHours.window}</span>
                </span>
              }
              action={
                <span className="cursor-pointer font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-rust hover:text-rust-deep">
                  Edit ✎
                </span>
              }
            />
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
