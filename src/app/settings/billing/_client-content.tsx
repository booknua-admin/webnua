import { BillingPlanCard } from '@/components/shared/settings/BillingPlanCard';
import { InvoiceList } from '@/components/shared/settings/InvoiceList';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { clientSettingsNav } from '@/lib/nav/client-settings-nav';
import {
  clientBillingIncluded,
  clientBillingInvoices,
  clientBillingMethod,
  clientBillingPlan,
} from '@/lib/settings/client-billing';

export function ClientBillingContent() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Billing" />} />
      <SettingsShell
        eyebrow="Voltline · your account"
        title={
          <>
            Your <em>settings</em>.
          </>
        }
        subtitle="Your Webnua plan, payment method, and invoice history. Billed monthly in AUD."
        items={clientSettingsNav}
      >
        <SettingsPanel>
          <SettingsSection>
            <BillingPlanCard
              tag={clientBillingPlan.tag}
              name={clientBillingPlan.name}
              meta={clientBillingPlan.meta}
              action={
                <Button
                  variant="secondary"
                  className="border-paper/20 bg-paper/[0.08] text-paper hover:bg-paper/[0.12]"
                >
                  Talk to Craig
                </Button>
              }
            />
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                Payment <em>method</em>
              </>
            }
            description="Charged on the 1st of each month. Direct debit via Stripe."
          >
            <div className="grid grid-cols-[50px_1fr_100px] items-center gap-4 rounded-lg border border-rule bg-paper px-[18px] py-3.5">
              <div className="flex h-8 w-[50px] items-center justify-center rounded-sm bg-ink font-mono text-[10px] font-extrabold tracking-[0.04em] text-paper">
                {clientBillingMethod.cardIcon}
              </div>
              <div>
                <div className="text-[14px] font-bold text-ink">{clientBillingMethod.name}</div>
                <div className="mt-0.5 text-[12px] text-ink-quiet">{clientBillingMethod.meta}</div>
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
            description="Last 6 invoices · all amounts AUD inclusive of GST · sent to mark@voltline.com.au."
          >
            <InvoiceList invoices={clientBillingInvoices} />
          </SettingsSection>

          <SettingsSection
            heading={
              <>
                What&apos;s <em>included</em>
              </>
            }
            description="Your Webnua Perth plan covers everything below. Want to add something? Text Craig."
          >
            <div className="grid grid-cols-2 gap-2.5">
              {clientBillingIncluded.map((entry) => (
                <div
                  key={entry.item}
                  className="rounded-lg border border-rule bg-paper px-4 py-3.5 text-[13px] text-ink"
                >
                  ✓ <strong className="font-semibold">{entry.item}</strong>
                  {entry.sub ? ` · ${entry.sub}` : null}
                </div>
              ))}
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
