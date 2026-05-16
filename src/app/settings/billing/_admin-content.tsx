'use client';

// The operator's /settings/billing branch. Dispatches on workspace mode
// (Cluster 9 · Session 3): agency mode → Webnua Perth's own billing (a stub);
// sub-account mode → the drilled-in client's plan assignment + resolved policy
// bundle + invoices.

import { BillingPlanCard } from '@/components/shared/settings/BillingPlanCard';
import { InvoiceList } from '@/components/shared/settings/InvoiceList';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import {
  adminBillingInvoices,
  adminBillingMethod,
  adminBillingPlan,
} from '@/lib/settings/admin-billing';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

import { SubAccountBillingContent } from './_sub-account-content';

export function AdminBillingContent() {
  const { activeClient } = useWorkspace();

  if (activeClient) {
    return (
      <SubAccountBillingContent
        clientId={activeClient.id}
        clientName={activeClient.name}
      />
    );
  }

  return <AgencyBillingView />;
}

function AgencyBillingView() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Billing" />} />
      <SettingsShell
        eyebrow="Workspace · Webnua Perth"
        title={
          <>
            Settings + <em>integrations</em>.
          </>
        }
        subtitle={
          <>
            Your plan, payment method, and invoice history.{' '}
            <strong>Webnua Perth is billed monthly in AUD</strong> — base plan plus usage.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection>
            <BillingPlanCard
              tag={adminBillingPlan.tag}
              name={adminBillingPlan.name}
              meta={adminBillingPlan.meta}
              action={<Button>Change plan</Button>}
            />
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Payment <em>method</em>
              </>
            }
            description="Charged on the 1st of each month for the previous month's usage."
          >
            <div className="grid grid-cols-[50px_1fr_100px] items-center gap-4 rounded-lg border border-rule bg-paper px-[18px] py-3.5">
              <div className="flex h-8 w-[50px] items-center justify-center rounded-sm bg-ink font-mono text-[10px] font-extrabold tracking-[0.04em] text-paper">
                {adminBillingMethod.cardIcon}
              </div>
              <div>
                <div className="text-[14px] font-bold text-ink">{adminBillingMethod.name}</div>
                <div className="mt-0.5 text-[12px] text-ink-quiet">{adminBillingMethod.meta}</div>
              </div>
              <span className="cursor-pointer text-right font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-rust hover:text-rust-deep">
                Update
              </span>
            </div>
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Invoice <em>history</em>
              </>
            }
            description="Last 6 invoices. All amounts AUD inclusive of GST."
          >
            <InvoiceList invoices={adminBillingInvoices} />
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
