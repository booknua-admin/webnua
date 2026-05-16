'use client';

// =============================================================================
// /settings/plans — agency-level plan catalog (Cluster 9 · Session 2).
//
// The agency's catalog of billing plans. Each plan packages a policy bundle
// (seat limit, capability floor, integration defaults) that resolves as Layer
// 2.5 of the policy stack — between the agency default and a per-sub-account
// override. Plans are assigned to clients on /settings/billing in sub-account
// mode (Cluster 9 · Session 3).
//
// Agency-mode only — registered in adminSettingsNav and guarded AGENCY_ONLY in
// the settings layout.
// =============================================================================

import { PlanEditorCard } from '@/components/shared/settings/PlanEditorCard';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { INTEGRATION_PROVIDERS } from '@/lib/agency/integration-providers';
import { usePlanCatalog } from '@/lib/billing/hooks';
import { upsertPlan } from '@/lib/billing/plan-catalog-stub';

export default function PlansPage() {
  const catalog = usePlanCatalog();

  function handleAddPlan() {
    upsertPlan({
      id: `plan-${Date.now()}`,
      name: 'New plan',
      description: '',
      price: 0,
      currency: 'AUD',
      billingCycle: 'monthly',
      policy: {
        defaultSeatLimit: 5,
        defaultClientCapabilities: ['viewBuilder'],
        integrationDefaults: {
          sharedProviders: Object.fromEntries(
            INTEGRATION_PROVIDERS.map((p) => [p.id, false]),
          ),
        },
      },
    });
  }

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Plans" />}
      />
      <SettingsShell
        eyebrow="Agency · Webnua Perth"
        title={
          <>
            Plan <em>catalog</em>.
          </>
        }
        subtitle={
          <>
            <strong>The plans you offer sub-accounts.</strong> Each plan
            packages a policy bundle — seat limit, capability floor, integration
            defaults — that a client inherits when assigned the plan.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Billing <em>plans</em>
              </>
            }
            description={
              <>
                A plan&rsquo;s bundle resolves <strong>above</strong> the agency
                default and <strong>below</strong> a per-sub-account override.
                Deleting a plan reverts its clients to agency defaults.
              </>
            }
          >
            <div className="flex flex-col gap-4">
              {catalog.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-8 text-center">
                  <p className="font-sans text-[13px] text-ink-quiet">
                    No plans yet. Add one to start building the catalog.
                  </p>
                </div>
              ) : (
                catalog.map((plan) => (
                  <PlanEditorCard key={plan.id} plan={plan} />
                ))
              )}
              <div>
                <Button variant="secondary" size="sm" onClick={handleAddPlan}>
                  + Add plan
                </Button>
              </div>
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
