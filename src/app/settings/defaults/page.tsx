import { SettingsFieldRow } from '@/components/shared/settings/SettingsFieldRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  adminDefaultsAutomations,
  adminDefaultsBranding,
  adminDefaultsPricing,
} from '@/lib/settings/admin-defaults';

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
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Default <em>automations</em>
              </>
            }
            description="Which flows are turned on by default when you onboard a new client. They can override per-client during setup."
          >
            <div className="flex flex-col gap-4">
              {adminDefaultsAutomations.map((automation) => (
                <div
                  key={automation.id}
                  className="border-b border-dotted border-rule-soft pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="mb-1 text-[15px] font-bold text-ink">{automation.name}</div>
                  <div className="mb-2.5 text-[13px] leading-[1.45] text-ink-quiet">
                    {automation.description}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch defaultChecked={automation.defaultOn} />
                    <span
                      className={cn(
                        'text-[13px] font-bold',
                        automation.defaultOn ? 'text-ink' : 'text-ink-quiet',
                      )}
                    >
                      {automation.defaultOn ? 'ON by default' : 'OFF by default'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Default <em>branding</em>
              </>
            }
            description="Used as a starting point for new client funnels. Per-client branding overrides this."
          >
            {adminDefaultsBranding.map((field) => (
              <SettingsFieldRow
                key={field.label}
                label={field.label}
                value={
                  field.swatch ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 rounded-sm bg-rust" />
                      {field.value}
                    </span>
                  ) : (
                    field.value
                  )
                }
                action={
                  field.editable ? (
                    <span className="cursor-pointer font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-rust hover:text-rust-deep">
                      Edit ✎
                    </span>
                  ) : undefined
                }
              />
            ))}
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Default <em>pricing</em>
              </>
            }
            description="Suggested defaults for the offer fields in new client onboarding."
          >
            {adminDefaultsPricing.map((field) => (
              <SettingsFieldRow
                key={field.label}
                label={field.label}
                sub={field.sub}
                value={field.value}
                action={
                  field.editable ? (
                    <span className="cursor-pointer font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-rust hover:text-rust-deep">
                      Edit ✎
                    </span>
                  ) : undefined
                }
              />
            ))}
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
