'use client';

// =============================================================================
// /settings/integration-defaults — agency-level policy surface (Cluster 8 ·
// Session 3). Sets the `integrationDefaults` policy key (Layer 2): which
// integration providers the agency supplies shared keys for. Sub-accounts
// inherit these unless an operator overrides per client (/settings/access,
// sub-account mode — Session 4).
//
// Reads/writes the agency policy store directly (useAgencyPolicy +
// setAgencyPolicy) — the raw Layer-2 value, no resolution. This IS the surface
// that sets Layer 2.
// =============================================================================

import { setAgencyPolicy } from '@/lib/agency/agency-policy-stub';
import { INTEGRATION_PROVIDERS } from '@/lib/agency/integration-providers';
import { useAgencyPolicy } from '@/lib/agency/use-policy';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Switch } from '@/components/ui/switch';

export default function IntegrationDefaultsPage() {
  const defaults = useAgencyPolicy('integrationDefaults');

  function setShared(id: string, shared: boolean) {
    setAgencyPolicy('integrationDefaults', {
      sharedProviders: { ...defaults.sharedProviders, [id]: shared },
    });
  }

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Settings']} current="Integration defaults" />
        }
      />
      <SettingsShell
        eyebrow="Agency · Webnua Perth"
        title={
          <>
            Integration <em>defaults</em>.
          </>
        }
        subtitle={
          <>
            <strong>Agency-wide integration policy.</strong> Decide which
            providers the agency supplies shared keys for — every sub-account
            inherits these unless an operator overrides per client.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Shared <em>connections</em>
              </>
            }
            description={
              <>
                <strong>Agency-supplied</strong> means sub-accounts inherit the
                agency&rsquo;s connection by default — nothing for the client to
                set up. <strong>Per sub-account</strong> means each client
                connects their own keys.
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {INTEGRATION_PROVIDERS.map((provider) => {
                const shared = defaults.sharedProviders[provider.id] ?? false;
                return (
                  <div
                    key={provider.id}
                    className="flex items-start justify-between gap-6 border-b border-dotted border-rule-soft pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 text-[15px] font-bold text-ink">
                        {provider.name}
                      </div>
                      <div className="text-[13px] leading-[1.45] text-ink-quiet">
                        {provider.description}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={
                          'font-mono text-[10px] font-bold uppercase tracking-[0.12em] ' +
                          (shared ? 'text-good' : 'text-ink-quiet')
                        }
                      >
                        {shared ? 'Agency-supplied' : 'Per sub-account'}
                      </span>
                      <Switch
                        checked={shared}
                        onCheckedChange={(next) => setShared(provider.id, next)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
