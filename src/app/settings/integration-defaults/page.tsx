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
import { useAgencyPolicy } from '@/lib/agency/use-policy';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Switch } from '@/components/ui/switch';

type ProviderMeta = {
  id: string;
  name: string;
  description: string;
};

// Display metadata for the providers tracked in the integrationDefaults
// policy. The policy stores only the boolean per id; names + copy live here.
const PROVIDERS: ProviderMeta[] = [
  {
    id: 'resend',
    name: 'Resend',
    description: 'Transactional email — confirmations, follow-ups, summaries.',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS — lead alerts, booking reminders, review requests.',
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    description:
      'Ad campaign management. Each client usually runs their own ad account.',
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    description:
      'Reviews + business listing — tied to the client’s own Google account.',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Hosting + deployment for published funnels and websites.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description:
      'AI drafting — funnel copy, automation messages, page generation.',
  },
];

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
              {PROVIDERS.map((provider) => {
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
