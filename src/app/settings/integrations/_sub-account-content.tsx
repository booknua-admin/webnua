'use client';

// =============================================================================
// /settings/integrations — sub-account mode (Cluster 8 · Session 4b). The
// operator has drilled into one client; this shows that client's integration
// policy: per provider, whether it inherits the agency default or carries a
// per-account override.
//
// Reads the resolved `integrationDefaults` policy via usePolicy (which keys to
// the active workspace) and writes per-client overrides through the override
// store. Toggling a provider back to the agency value clears the override.
// =============================================================================

import { PolicyOverrideRow } from '@/components/shared/settings/PolicyOverrideRow';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Switch } from '@/components/ui/switch';
import { INTEGRATION_PROVIDERS } from '@/lib/agency/integration-providers';
import { clearOverride, setOverride } from '@/lib/agency/override-stub';
import { usePolicy } from '@/lib/agency/use-policy';

type SharedProviders = Record<string, boolean>;

function sameProviders(a: SharedProviders, b: SharedProviders): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] ?? false) !== (b[key] ?? false)) return false;
  }
  return true;
}

type SubAccountIntegrationsContentProps = {
  clientId: string;
  clientName: string;
};

export function SubAccountIntegrationsContent({
  clientId,
  clientName,
}: SubAccountIntegrationsContentProps) {
  const resolution = usePolicy('integrationDefaults');
  const effective = resolution.effectiveValue.sharedProviders;
  const agency = resolution.agencyValue.sharedProviders;

  // Write the next per-provider map as an override — or clear the override
  // entirely when it lands back on the agency value.
  function applyProviders(nextShared: SharedProviders) {
    if (sameProviders(nextShared, agency)) {
      clearOverride(clientId, 'integrationDefaults');
    } else {
      setOverride(clientId, 'integrationDefaults', {
        sharedProviders: nextShared,
      });
    }
  }

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Integrations" />}
      />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Integrations for <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>What {clientName} inherits from the agency.</strong> Each
            provider follows the agency default unless you override it for this
            client.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Inherited <em>connections</em>
              </>
            }
            description={
              <>
                <strong>Agency-supplied</strong> providers need nothing from{' '}
                {clientName}. Override a provider to make this client connect
                their own keys instead — or the reverse.
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {INTEGRATION_PROVIDERS.map((provider) => {
                const shared = effective[provider.id] ?? false;
                const agencyShared = agency[provider.id] ?? false;
                const overridden = shared !== agencyShared;
                return (
                  <PolicyOverrideRow
                    key={provider.id}
                    label={provider.name}
                    description={provider.description}
                    source={overridden ? 'overridden' : 'inherited'}
                    agencyHint={`agency · ${agencyShared ? 'supplied' : 'per sub-account'}`}
                    onRevert={() =>
                      applyProviders({ ...effective, [provider.id]: agencyShared })
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={shared}
                        onCheckedChange={(next) =>
                          applyProviders({ ...effective, [provider.id]: next })
                        }
                      />
                      <span
                        className={
                          'font-mono text-[10px] font-bold uppercase tracking-[0.12em] ' +
                          (shared ? 'text-good' : 'text-ink-quiet')
                        }
                      >
                        {shared ? 'Agency-supplied' : 'Per sub-account'}
                      </span>
                    </div>
                  </PolicyOverrideRow>
                );
              })}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
