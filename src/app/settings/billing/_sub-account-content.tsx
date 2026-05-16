'use client';

// =============================================================================
// /settings/billing — sub-account mode (Cluster 9 · Session 3).
//
// The operator has drilled into one client; this is that client's billing:
// assign a plan from the agency catalog, see the plan's resolved policy bundle
// (seat limit, capability floor, integration defaults — walked through the
// policy resolver), and the invoice history.
//
// Invoices are display stubs derived from the assigned plan — real billing /
// Stripe is a backend concern, out of scope for the stub layer.
// =============================================================================

import { BillingPlanCard } from '@/components/shared/settings/BillingPlanCard';
import { InvoiceList, type Invoice } from '@/components/shared/settings/InvoiceList';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePolicy } from '@/lib/agency/use-policy';
import { INTEGRATION_PROVIDERS } from '@/lib/agency/integration-providers';
import { CAPABILITY_LABEL } from '@/lib/auth/capabilities';
import { useAssignedPlan, usePlanCatalog } from '@/lib/billing/hooks';
import {
  clearPlanAssignment,
  setPlanAssignment,
} from '@/lib/billing/plan-assignment-stub';
import type { Plan } from '@/lib/billing/types';

const NONE = '__none__';

type PolicySource = 'agency' | 'plan' | 'override';

function cycleNoun(plan: Plan): string {
  return plan.billingCycle === 'yearly' ? 'year' : 'month';
}

function SourceBadge({ source }: { source: PolicySource }) {
  const tone =
    source === 'override'
      ? 'bg-rust-soft text-rust'
      : source === 'plan'
        ? 'bg-info/15 text-info'
        : 'bg-paper-2 text-ink-quiet';
  const label =
    source === 'override'
      ? 'Account override'
      : source === 'plan'
        ? 'From plan'
        : 'Agency default';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${tone}`}
    >
      {label}
    </span>
  );
}

function GrantRow({
  label,
  source,
  children,
}: {
  label: string;
  source: PolicySource;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-dotted border-rule-soft pb-3.5 last:border-b-0 last:pb-0">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
          {label}
        </span>
        <SourceBadge source={source} />
      </div>
      <div className="text-[13px] leading-[1.5] text-ink">{children}</div>
    </div>
  );
}

// Display-stub invoices — three months at the assigned plan's price. Real
// invoices arrive with the billing backend.
function planInvoices(plan: Plan): Invoice[] {
  const months = [
    { label: 'May 2026', status: 'pending' as const },
    { label: 'Apr 2026', status: 'paid' as const },
    { label: 'Mar 2026', status: 'paid' as const },
  ];
  return months.map((m, i) => ({
    id: `${plan.id}-${i}`,
    date: `1 ${m.label}`,
    description: `${plan.name} plan · ${m.label}`,
    amount: `$${plan.price.toFixed(2)}`,
    status: m.status,
  }));
}

type SubAccountBillingContentProps = {
  clientId: string;
  clientName: string;
};

export function SubAccountBillingContent({
  clientId,
  clientName,
}: SubAccountBillingContentProps) {
  const catalog = usePlanCatalog();
  const assignedPlan = useAssignedPlan(clientId);

  const seatLimit = usePolicy('defaultSeatLimit');
  const capabilities = usePolicy('defaultClientCapabilities');
  const integrations = usePolicy('integrationDefaults');

  function handlePlanChange(value: string) {
    if (value === NONE) {
      clearPlanAssignment(clientId);
    } else {
      setPlanAssignment(clientId, value);
    }
  }

  const sharedProviders = integrations.effectiveValue.sharedProviders;
  const suppliedProviders = INTEGRATION_PROVIDERS.filter(
    (p) => sharedProviders[p.id],
  );

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Billing" />}
      />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Billing for <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>The plan {clientName} is on.</strong> A plan packages a
            policy bundle the client inherits — seat limit, capability floor,
            integration defaults — unless a per-account override says otherwise.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Assigned <em>plan</em>
              </>
            }
            description={
              <>
                Choose a plan from the agency catalog. Define and edit plans on{' '}
                <strong>Settings → Plans</strong> in agency mode.
              </>
            }
          >
            {assignedPlan ? (
              <BillingPlanCard
                tag="Assigned plan"
                name={assignedPlan.name}
                meta={
                  assignedPlan.description ||
                  `Billed ${assignedPlan.billingCycle}.`
                }
                action={
                  <div className="text-right">
                    <div className="text-[22px] font-extrabold leading-none text-paper">
                      {assignedPlan.currency} ${assignedPlan.price.toFixed(2)}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60">
                      per {cycleNoun(assignedPlan)}
                    </div>
                  </div>
                }
              />
            ) : (
              <div className="mb-2 rounded-xl border border-dashed border-rule bg-paper px-7 py-6">
                <div className="text-[15px] font-bold text-ink">
                  No plan assigned
                </div>
                <p className="mt-1 text-[13px] leading-[1.5] text-ink-quiet">
                  {clientName} resolves straight to agency defaults. Assign a
                  plan to apply a packaged policy bundle.
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
                Plan
              </span>
              <Select
                value={assignedPlan?.id ?? NONE}
                onValueChange={handlePlanChange}
              >
                <SelectTrigger size="sm" className="w-64 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No plan — agency defaults</SelectItem>
                  {catalog.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} · {plan.currency} ${plan.price.toFixed(2)}/
                      {cycleNoun(plan)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                What the <em>plan grants</em>
              </>
            }
            description={
              <>
                The policy bundle resolved for {clientName} — the assigned plan
                where it speaks, the agency default otherwise, a per-account
                override above both.
              </>
            }
          >
            <div className="flex flex-col gap-3.5 rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
              <GrantRow label="Seat limit" source={seatLimit.source}>
                {seatLimit.effectiveValue === null
                  ? 'Uncapped — no limit on users.'
                  : `${seatLimit.effectiveValue} users maximum.`}
              </GrantRow>

              <GrantRow label="Capability floor" source={capabilities.source}>
                {capabilities.effectiveValue.length === 0 ? (
                  <span className="text-ink-quiet">No default capabilities.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.effectiveValue.map((cap) => (
                      <span
                        key={cap}
                        className="rounded-pill bg-paper-2 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-soft"
                      >
                        {CAPABILITY_LABEL[cap]}
                      </span>
                    ))}
                  </div>
                )}
              </GrantRow>

              <GrantRow label="Integration defaults" source={integrations.source}>
                {suppliedProviders.length === 0 ? (
                  <span className="text-ink-quiet">
                    None agency-supplied — {clientName} connects every provider.
                  </span>
                ) : (
                  <>
                    Agency-supplied:{' '}
                    <strong className="font-semibold">
                      {suppliedProviders.map((p) => p.name).join(', ')}
                    </strong>
                    .
                  </>
                )}
              </GrantRow>
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Invoice <em>history</em>
              </>
            }
            description="Display stubs — real invoices arrive with the billing backend."
          >
            {assignedPlan ? (
              <InvoiceList invoices={planInvoices(assignedPlan)} />
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-rule bg-paper px-[18px] py-8 text-center text-[13px] text-ink-quiet">
                No invoices — {clientName} has no plan assigned.
              </div>
            )}
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
