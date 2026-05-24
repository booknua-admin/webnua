'use client';

// =============================================================================
// Client /settings/billing — real Stripe billing surface.
//
// Replaces the previous Voltline-keyed stub (hardcoded plan / fake card / six
// fake invoices / inert "Update" + "Talk to Craig" affordances). The audit
// (reference/onboarding-flow-audit.md §3 / Settings / Billing) flagged this
// as Critical: a client cannot subscribe, manage a card, see real invoices,
// or cancel through the stub.
//
// The new surface mounts the same `StripeSubscriptionSection` the operator
// sub-account view uses. The Stripe `/checkout` + `/portal` routes were
// widened to `requireClientAccess` in the same session — a client subscribes
// themselves, manages their own card, views their own invoices (via the
// Stripe Customer Portal), and cancels themselves.
// =============================================================================

import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsShell } from '@/components/shared/settings/SettingsShell';
import { StripeSubscriptionSection } from '@/components/shared/settings/StripeSubscriptionSection';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';

export function ClientBillingContent() {
  const user = useUser();
  const clients = useAdminClients();

  // Resolve the client record for the signed-in user — same shape as the
  // sidebar identity fix. `user.clientId` is the slug; the record carries
  // the name we display in the eyebrow + section copy.
  const client = user?.clientId
    ? (clients.find((c) => c.id === user.clientId) ?? null)
    : null;
  const clientName = client?.name ?? 'your account';

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Settings']} current="Billing" />} />
      <SettingsShell
        eyebrow={`${clientName} · your account`}
        title={
          <>
            Your <em>billing</em>.
          </>
        }
        subtitle={
          <>
            <strong>Your Webnua subscription.</strong> Set up billing, update your card, view
            invoices, or cancel — all through Stripe&apos;s secure portal.
          </>
        }
      >
        <SettingsPanel>
          {client ? (
            <StripeSubscriptionSection clientSlug={client.id} clientName={client.name} />
          ) : (
            <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
              Resolving your workspace…
            </div>
          )}
        </SettingsPanel>
      </SettingsShell>
    </>
  );
}
