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

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useClientId } from '@/lib/clients/queries';
import {
  formatPlanPrice,
  startStripeCheckout,
  usePlanInfo,
} from '@/lib/integrations/stripe/use-billing';
import { supabase } from '@/lib/supabase/client';

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
  const { data: clientUuid } = useClientId(clientSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request-review state: requesting → sending; requested → already lodged
  // (read from clients.review_requested_at on mount). The two paths
  // (direct publish vs request review) are NOT mutually exclusive — the
  // request is a SIGNAL to the operator, not a publish lock. The customer
  // can still hit Publish even after requesting review.
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewRequestedAt, setReviewRequestedAt] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientUuid) return;
    let active = true;
    supabase
      .from('clients')
      .select('review_requested_at')
      .eq('id', clientUuid)
      .single()
      .then(({ data }) => {
        if (!active) return;
        const row = data as { review_requested_at?: string | null } | null;
        setReviewRequestedAt(row?.review_requested_at ?? null);
      });
    return () => {
      active = false;
    };
  }, [clientUuid]);

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

  const onRequestReview = async () => {
    if (reviewBusy || !clientUuid) return;
    setReviewError(null);
    setReviewBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sign in again to request a review.');
      const res = await fetch(`/api/clients/${clientUuid}/request-review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status}).`);
      }
      setReviewRequestedAt(new Date().toISOString());
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not request review.');
    } finally {
      setReviewBusy(false);
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
          {reviewRequestedAt ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-good md:text-right">
              ✓ Review requested · we&rsquo;ll be in touch within 24h
            </p>
          ) : (
            <button
              type="button"
              onClick={onRequestReview}
              disabled={reviewBusy || !clientUuid}
              className="text-[12px] text-paper/70 underline-offset-2 hover:text-paper hover:underline disabled:cursor-not-allowed disabled:opacity-60 md:text-right"
            >
              {reviewBusy
                ? 'Sending request…'
                : 'Or request operator review first →'}
            </button>
          )}
          <p className="text-[11px] text-paper/55 md:text-right">
            Cancel any time from Settings &rarr; Billing.
          </p>
        </div>
      </div>

      {(disabledReason || error || reviewError) ? (
        <div className="border-t border-paper/10 bg-warn/10 px-7 py-3 text-[12px] leading-[1.5] text-warn">
          {disabledReason ?? error ?? reviewError}
        </div>
      ) : null}
    </div>
  );
}
