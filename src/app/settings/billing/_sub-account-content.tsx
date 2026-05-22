'use client';

// =============================================================================
// /settings/billing — sub-account mode.
//
// The operator has drilled into one client; this is that client's billing —
// the Stripe subscription that charges them (StripeSubscriptionSection).
//
// The agency POLICY-plan layer (assign a catalog plan to a sub-account, view
// the resolved policy bundle) is intentionally NOT surfaced here yet: an
// integrated upgrade path — plan tiers tied to access restrictions — is a
// later phase. The plan catalog + policy resolver still exist (lib/billing/,
// lib/agency/) and drive /settings/plans and the agency defaults; this page
// just no longer exposes per-client plan assignment. Per-client access is set
// manually by the operator on /settings/access.
// =============================================================================

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { StripeSubscriptionSection } from '@/components/shared/settings/StripeSubscriptionSection';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';

type SubAccountBillingContentProps = {
  clientId: string;
  clientName: string;
};

export function SubAccountBillingContent({ clientId, clientName }: SubAccountBillingContentProps) {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Billing" />} />
      <SettingsShell
        eyebrow={`Sub-account · ${clientName}`}
        title={
          <>
            Billing for <em>{clientName}</em>.
          </>
        }
        subtitle={
          <>
            <strong>{clientName}&apos;s Stripe subscription.</strong> Set up billing, check payment
            status, and manage the subscription.
          </>
        }
      >
        <SettingsPanel>
          <StripeSubscriptionSection clientSlug={clientId} clientName={clientName} />
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
