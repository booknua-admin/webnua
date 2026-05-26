'use client';

// The operator's /settings/integrations branch. Dispatches on workspace mode:
// agency mode → the cross-client overview (matrix + nudge cards) plus the
// agency connection policy; sub-account mode → the per-client integration
// policy (which providers this client inherits from the agency vs overrides).
//
// Platform plumbing (Stripe / Resend / Twilio / Anthropic / Vercel) is NOT
// here — it lives on /settings/api ("API & services"). This surface is for
// the business integrations each client connects.

import { SubAccountIntegrationsContent } from './_sub-account-content';
import { IntegrationMatrix } from '@/components/admin/integrations/IntegrationMatrix';
import { IntegrationMatrixActionCard } from '@/components/admin/integrations/IntegrationMatrixActionCard';
import { IntegrationMatrixHero } from '@/components/admin/integrations/IntegrationMatrixHero';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Switch } from '@/components/ui/switch';
import { setAgencyPolicy } from '@/lib/agency/agency-policy-stub';
import { INTEGRATION_PROVIDERS } from '@/lib/agency/integration-providers';
import { useAgencyPolicy } from '@/lib/agency/use-policy';
import {
  adminMatrixAttention,
  adminMatrixColumns,
  adminMatrixFilters,
  adminMatrixGaps,
  adminMatrixHero,
  adminMatrixRows,
} from '@/lib/integrations/admin-matrix';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export function AdminIntegrationsContent() {
  const { activeClient } = useWorkspace();

  if (activeClient) {
    return (
      <SubAccountIntegrationsContent
        clientId={activeClient.id}
        clientName={activeClient.name}
      />
    );
  }

  return <AgencyIntegrationsView />;
}

function AgencyIntegrationsView() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Integrations" />} />
      <SettingsShell
        eyebrow="Agency · Webnua"
        title={
          <>
            Client <em>integrations</em>.
          </>
        }
        subtitle="Every client's connection status in one view — see what's connected, what's broken, and nudge clients to finish setup."
      >
        <div className="flex flex-col gap-7">
          <IntegrationMatrixHero
            tag={adminMatrixHero.tag}
            title={adminMatrixHero.title}
            subtitle={adminMatrixHero.subtitle}
            stats={adminMatrixHero.stats}
          />

          <IntegrationMatrix
            title={
              <>
                Integration <em>matrix</em> · {adminMatrixRows.length} clients ×{' '}
                {adminMatrixColumns.length} integrations
              </>
            }
            filters={adminMatrixFilters}
            activeFilter="all"
            columns={adminMatrixColumns}
            rows={adminMatrixRows}
          />

          <div className="grid grid-cols-2 gap-3.5">
            <IntegrationMatrixActionCard
              tone="attention"
              heading="Needs your attention"
              badge={{ label: String(adminMatrixAttention.length), tone: 'warn' }}
              description={
                <>
                  Token expired or connection broken.{' '}
                  <strong>Trigger a reauth request to the client</strong> — they&apos;ll get a
                  notification.
                </>
              }
              items={adminMatrixAttention}
            />
            <IntegrationMatrixActionCard
              heading="Critical gaps"
              badge={{ label: String(adminMatrixGaps.length), tone: 'info' }}
              description={
                <>
                  Missing integrations that block a service from working.{' '}
                  <strong>Send a setup nudge</strong> with a one-click connect link.
                </>
              }
              items={adminMatrixGaps}
            />
          </div>

          <ConnectionPolicySection />
        </div>
      </SettingsShell>
    </>
  );
}

// The agency-level integration policy (Layer 2 of the policy stack). Per
// provider, a single agency-wide rule: agency-supplied (one shared connection,
// every sub-account inherits) vs per sub-account (each client connects their
// own keys). Operators override this per client in sub-account mode. This is
// the former /settings/integration-defaults tab, folded in here so integration
// management lives in one place.
function ConnectionPolicySection() {
  const defaults = useAgencyPolicy('integrationDefaults');

  function setShared(id: string, shared: boolean) {
    setAgencyPolicy('integrationDefaults', {
      sharedProviders: { ...defaults.sharedProviders, [id]: shared },
    });
  }

  return (
    <SettingsPanel>
      <SettingsSection
        heading={
          <>
            Connection <em>policy</em>
          </>
        }
        description={
          <>
            <strong>Agency-wide default per provider.</strong> <strong>Agency-supplied</strong>{' '}
            means sub-accounts inherit the agency&rsquo;s connection — nothing for the client to set
            up. <strong>Per sub-account</strong> means each client connects their own keys. Override
            per client by drilling into a sub-account.
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
                  <div className="mb-1 text-[15px] font-bold text-ink">{provider.name}</div>
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
  );
}
