'use client';

// The operator's /settings/billing branch. Dispatches on workspace mode:
// agency mode → placeholder until the agency plan launches (see below);
// sub-account mode → the drilled-in client's Stripe subscription (real,
// Phase 7 Stripe billing).

import Link from 'next/link';

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
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

// Agency-mode billing is a future surface — it's where the agency plan's own
// catalog + payment method + invoice history would live once Webnua sells to
// other operators. Today the only operator IS the Software Owner; there's no
// agency-side billing relationship to render. The previous view rendered
// hardcoded "$99 Webnua plan" + fake invoices imported from a stub module;
// that's been replaced with this honest placeholder until the agency plan
// launches. Sub-account billing (the drilled-in client's Stripe subscription)
// is real + unaffected.
function AgencyBillingView() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Billing" />} />
      <SettingsShell
        eyebrow="Agency · Webnua"
        title={
          <>
            Agency <em>billing</em>.
          </>
        }
        subtitle={
          <>
            <strong>This surface comes online when you launch the agency
            plan.</strong> When other operators sign up to run Webnua as an
            agency, their plan, payment method, and invoices live here. For
            now, drill into a sub-account to see a client&apos;s Stripe
            subscription, or visit Plans to define what you&apos;ll offer.
          </>
        }
      >
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Coming <em>soon</em>
              </>
            }
            description="Drill into a client to see their real Stripe subscription, or open Plans to define your agency-tier catalog."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link href="/settings/plans">Open Plans →</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </SettingsSection>
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
