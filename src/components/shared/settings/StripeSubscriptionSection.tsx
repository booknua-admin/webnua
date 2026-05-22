'use client';

// =============================================================================
// StripeSubscriptionSection — the Stripe billing panel on sub-account
// /settings/billing.
//
// Phase 7 Stripe billing session. Operator-facing. Shows the client's
// subscription status, last payment and next renewal date, with a "Set up
// billing" affordance for clients without a subscription (→ Stripe Checkout)
// and a "Manage billing" affordance for clients with one (→ Stripe Customer
// Portal).
//
// Distinct concern from the plan-assignment section below it: that is the
// agency POLICY plan (the resolved capability / seat / integration bundle);
// THIS is the real money — the Stripe subscription that actually charges the
// client €299/month.
// =============================================================================

import { useState, useSyncExternalStore } from 'react';

import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { useClientId } from '@/lib/clients/queries';
import type { StripeBillingStatus } from '@/lib/integrations/stripe/types';
import {
  openStripePortal,
  startStripeCheckout,
  useStripeBilling,
  type StripeBillingView,
} from '@/lib/integrations/stripe/use-billing';

// --- status presentation -----------------------------------------------------

const STATUS_DISPLAY: Record<StripeBillingStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-good/12 text-good' },
  past_due: { label: 'Payment overdue', className: 'bg-warn/12 text-warn' },
  incomplete: { label: 'Not set up', className: 'bg-ink/[0.06] text-ink-quiet' },
  cancelled: { label: 'Cancelled', className: 'bg-ink/[0.06] text-ink-quiet' },
  paused: { label: 'Paused', className: 'bg-ink/[0.06] text-ink-quiet' },
};

/** A subscription that charges money — show its detail + the portal. */
function hasLiveSubscription(billing: StripeBillingView | null | undefined): boolean {
  return (
    billing != null &&
    billing.hasSubscription &&
    (billing.status === 'active' || billing.status === 'past_due')
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// --- ?stripe= result banner --------------------------------------------------

/** Reads window.location.search through useSyncExternalStore — '' on the
 *  server, a reference-stable string in the browser. */
function useLocationSearch(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.search,
    () => '',
  );
}

function StripeResultBanner() {
  const search = useLocationSearch();
  const [dismissed, setDismissed] = useState(false);

  const value = new URLSearchParams(search).get('stripe');
  if (!value || dismissed) return null;

  const message: { tone: 'good' | 'warn'; text: string } | null =
    value === 'success'
      ? {
          tone: 'good',
          text: 'Checkout complete — the subscription is being activated. It can take a moment for Stripe to confirm.',
        }
      : value === 'cancelled'
        ? { tone: 'warn', text: 'Checkout was cancelled — no subscription was started.' }
        : null;
  if (!message) return null;

  function dismiss() {
    setDismissed(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('stripe');
    window.history.replaceState({}, '', url.toString());
  }

  return (
    <div
      className={
        'mb-4 flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-[13px] font-medium ' +
        (message.tone === 'good' ? 'bg-good/10 text-good' : 'bg-warn/10 text-warn')
      }
    >
      <span>{message.text}</span>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] opacity-70 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}

// --- key/value row -----------------------------------------------------------

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dotted border-rule-soft py-2 last:border-b-0">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </span>
      <span className="text-[13px] font-semibold text-ink">{children}</span>
    </div>
  );
}

// --- the section -------------------------------------------------------------

type StripeSubscriptionSectionProps = {
  /** The drilled-into client's slug (the workspace active-client id). */
  clientSlug: string;
  clientName: string;
};

export function StripeSubscriptionSection({
  clientSlug,
  clientName,
}: StripeSubscriptionSectionProps) {
  const { data: clientId } = useClientId(clientSlug);
  const billing = useStripeBilling(clientId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = billing.data ?? null;
  const live = hasLiveSubscription(view);

  async function run(action: (id: string) => Promise<void>) {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      // Resolves only on failure — on success the browser navigates to Stripe.
      await action(clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      heading={
        <>
          Subscription &amp; <em>payment</em>
        </>
      }
      description={
        <>
          <strong>{clientName}&apos;s Stripe subscription.</strong> The platform fee is{' '}
          <strong>€299/month</strong>. The first month is €99 to Webnua plus €200 spent as Meta ad
          credit on the client&apos;s behalf; from month two it is €299/month, with the
          client&apos;s own Meta ad spend billed separately. Stripe charges a flat €299 every month.
        </>
      }
    >
      <StripeResultBanner />

      {billing.isLoading ? (
        <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px] text-[13px] text-ink-quiet">
          Loading billing status…
        </div>
      ) : live && view ? (
        <div className="rounded-[10px] border border-rule bg-paper px-5 py-[18px]">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[15px] font-bold text-ink">Subscription</span>
            <StatusPill status={view.status} />
          </div>

          <div className="flex flex-col">
            <DetailRow label="Plan">€299 / month</DetailRow>
            <DetailRow label="Next renewal">{formatDate(view.currentPeriodEnd)}</DetailRow>
            <DetailRow label="Last payment">
              {view.lastPaymentAt ? (
                <>
                  {formatDate(view.lastPaymentAt)}
                  {view.lastPaymentStatus === 'failed' ? (
                    <span className="ml-1.5 text-warn">· failed</span>
                  ) : null}
                </>
              ) : (
                '—'
              )}
            </DetailRow>
          </div>

          {view.status === 'past_due' ? (
            <p className="mt-3 text-[12px] leading-[1.5] text-warn">
              The last payment failed. The client has a 7-day grace window to update their card
              before access is suspended — use Manage billing to send them to the Stripe portal.
            </p>
          ) : null}
          {view.cancelAtPeriodEnd ? (
            <p className="mt-3 text-[12px] leading-[1.5] text-ink-quiet">
              This subscription is set to cancel on{' '}
              <strong className="font-semibold text-ink">
                {formatDate(view.currentPeriodEnd)}
              </strong>
              .
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !clientId}
              onClick={() => run(openStripePortal)}
            >
              {busy ? 'Opening…' : 'Manage billing →'}
            </Button>
            <span className="text-[12px] text-ink-quiet">
              Update the card, view invoices, or cancel in the Stripe portal.
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-[10px] border border-dashed border-rule bg-paper px-5 py-[18px]">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[15px] font-bold text-ink">No active subscription</span>
            {view ? <StatusPill status={view.status} /> : null}
          </div>
          <p className="mb-4 text-[13px] leading-[1.5] text-ink-quiet">
            {view?.status === 'cancelled'
              ? `${clientName}'s subscription has been cancelled. Start a new subscription to resume billing.`
              : `${clientName} is not being billed yet. Set up the €299/month subscription — the client completes payment on Stripe's secure checkout.`}
          </p>
          <Button size="sm" disabled={busy || !clientId} onClick={() => run(startStripeCheckout)}>
            {busy ? 'Starting…' : 'Set up billing →'}
          </Button>
        </div>
      )}

      {error ? <p className="mt-3 text-[12px] leading-[1.45] text-warn">{error}</p> : null}
      {billing.isError ? (
        <p className="mt-3 text-[12px] leading-[1.45] text-warn">
          Could not load billing status. Refresh to try again.
        </p>
      ) : null}
    </SettingsSection>
  );
}

function StatusPill({ status }: { status: StripeBillingStatus }) {
  const { label, className } = STATUS_DISPLAY[status];
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${className}`}
    >
      {label}
    </span>
  );
}
