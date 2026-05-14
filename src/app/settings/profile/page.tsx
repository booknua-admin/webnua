import { SettingsFieldRow } from '@/components/shared/settings/SettingsFieldRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';
import { clientProfileBusiness, clientProfileManagedByWebnua } from '@/lib/settings/client-profile';

export default function ClientSettingsProfilePage() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Profile" />} />
      <SettingsShell
        eyebrow="Voltline · your account"
        title={
          <>
            Your <em>settings</em>.
          </>
        }
        subtitle={
          <>
            Profile, notifications, and where to find help.{' '}
            <strong>Webnua manages your funnel, automations, and ads</strong> — those settings live
            on Craig&apos;s side.
          </>
        }
        items={clientSettingsNav}
      >
        <SettingsPanel>
          <SettingsSection
            heading="Business profile"
            description="Your business details. Used on your landing page, in automated messages, and on invoices. Need a change? Ping Craig — he'll update everything in sync."
          >
            {clientProfileBusiness.map((field) => (
              <SettingsFieldRow
                key={field.label}
                label={field.label}
                sub={field.sub}
                value={field.value}
                action={
                  field.action ? (
                    <span className="cursor-pointer font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-rust hover:text-rust-deep">
                      {field.action}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading="Managed by Webnua"
            description="Things Craig and the Webnua team handle for you. Want to change any of these? Text Craig at 0411 234 567."
          >
            {clientProfileManagedByWebnua.map((field) => (
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
