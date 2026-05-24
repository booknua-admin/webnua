'use client';

// =============================================================================
// PublishToGoLiveCTA — Pattern B's pay-to-publish moment.
//
// Mounted on the IntegrationOnboarding surface when the client is in
// 'preview' state. Clicking it kicks the existing Stripe Checkout flow
// (the same /api/integrations/stripe/checkout route the operator-side uses,
// widened to requireClientAccess in Session 1). On successful payment the
// Stripe webhook calls `markClientActiveOnPublish` which flips the client
// from 'preview' to 'active' — and the dashboard then renders the live
// hub instead of this onboarding surface on the next page load.
//
// Visual: a prominent ink-bg "Publish your site" card with the live plan
// price (fetched live from Stripe via the existing usePlanInfo hook), what
// publishing unlocks, and the rust CTA button. Mirrors the dark-card
// aesthetic of `BillingPlanCard` / `CampaignManagedBand`.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  formatPlanPrice,
  startStripeCheckout,
  usePlanInfo,
} from '@/lib/integrations/stripe/use-billing';

type PublishToGoLiveCTAProps = {
  /** The drilled-into / signed-in client's slug. The checkout route
   *  resolves it via useClientId → POST clientId on the body. */
  clientSlug: string;
  /** The client's display name — for the headline copy. */
  clientName: string;
  /** Optional override to disable the CTA when the workspace has not yet
   *  produced any site or funnel for the customer to preview. We do not
   *  block the user from paying (some operators will configure that
   *  out-of-band) — we just dim the CTA with a note. */
  disabledReason?: string | null;
};

export function PublishToGoLiveCTA({
  clientSlug,
  clientName,
  disabledReason,
}: PublishToGoLiveCTAProps) {
  const planInfo = usePlanInfo();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceLabel = planInfo.data
    ? formatPlanPrice(planInfo.data)
    : planInfo.isLoading
      ? 'Loading pricing…'
      : 'Pricing unavailable';

  const onPublish = async () => {
    if (busy || disabledReason) return;
    setError(null);
    setBusy(true);
    try {
      // Resolves only on failure — on success the browser navigates to Stripe.
      await startStripeCheckout(clientSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setBusy(false);
    }
  };

  return (
    <div
      data-slot="publish-to-go-live-cta"
      className="overflow-hidden rounded-xl border border-ink bg-ink text-paper"
    >
      {/* Top band — the pulsing dot + tag + price */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper/10 px-7 py-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-2 rounded-full bg-rust-light"
            style={{ boxShadow: '0 0 0 4px rgba(232,116,59,0.18)' }}
          />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust-light">
            {'// Ready to publish?'}
          </span>
        </div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-paper/70">
          {priceLabel}
        </span>
      </div>

      {/* Headline + CTA */}
      <div className="grid grid-cols-1 gap-6 px-7 py-7 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <h2 className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em]">
            Take {clientName}{' '}
            <em className="font-extrabold not-italic text-rust-light">live</em>.
          </h2>
          <p className="mt-2.5 text-[14px] leading-[1.55] text-paper/75">
            You&rsquo;ve built it. One click + payment activates the site at your
            public URL, switches lead-capture forms on, and brings your
            operator on board to launch your first Meta campaign.
          </p>
          <ul className="mt-4 flex flex-col gap-1.5 text-[13px] leading-[1.5] text-paper/70">
            <li>
              <span className="text-good">✓</span> Public URL goes live + indexable
            </li>
            <li>
              <span className="text-good">✓</span> Lead-capture forms switch on
            </li>
            <li>
              <span className="text-good">✓</span> Webnua starts running your ads
            </li>
          </ul>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <Button
            size="lg"
            onClick={onPublish}
            disabled={busy || !!disabledReason || planInfo.isLoading}
            className="bg-rust text-paper hover:bg-rust-deep"
          >
            {busy ? 'Opening checkout…' : 'Publish to go live →'}
          </Button>
          <p className="text-[11px] text-paper/55 md:text-right">
            Cancel any time from Settings &rarr; Billing.
          </p>
        </div>
      </div>

      {(disabledReason || error) ? (
        <div className="border-t border-paper/10 bg-warn/10 px-7 py-3 text-[12px] leading-[1.5] text-warn">
          {disabledReason ?? error}
        </div>
      ) : null}
    </div>
  );
}
