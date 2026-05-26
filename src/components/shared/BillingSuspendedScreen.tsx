'use client';

// =============================================================================
// BillingSuspendedScreen — full-screen interstitial shown in place of the
// dashboard when `shouldGateClientAccess()` returns true for the active
// client (the 7-day past_due grace window has elapsed, or the subscription
// was cancelled and the cancellation banner path hasn't picked it up yet).
//
// Sibling of `CancellationBanner` — that one is a notice ABOVE the regular
// dashboard for the Stage 1 ('cancelled') grace window; this one is a hard
// stop INSTEAD of the dashboard for the post-grace state. Both surface the
// same Stripe Portal as the recovery path; that's where the customer
// updates their card or restarts billing.
//
// Mounted by `app/dashboard/page.tsx` only when `/api/clients/[id]/billing-
// gate` returns `gated: true`. CLAUDE.md compliance — no emojis.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';

import type { BillingGateResponse } from '@/app/api/clients/[id]/billing-gate/route';

type BillingSuspendedScreenProps = {
  /** UUID of the client. */
  clientId: string;
  /** Display name for the headline. */
  clientName: string;
  /** Why the gate fired — drives copy choice. */
  reason: NonNullable<BillingGateResponse['reason']>;
};

export function BillingSuspendedScreen({
  clientId,
  clientName,
  reason,
}: BillingSuspendedScreenProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdatePayment() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`/api/integrations/stripe/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(humanisePortalError(body.error ?? `${res.status}`));
        setPending(false);
        return;
      }
      const body = (await res.json()) as { url?: string };
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      window.location.reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(`Could not open billing: ${message}`);
      setPending(false);
    }
  }

  const headline =
    reason === 'cancelled'
      ? `Your ${clientName} subscription was cancelled.`
      : `Your ${clientName} subscription is on hold — payment failed.`;
  const body = COPY_BY_REASON[reason];

  return (
    <div className="flex min-h-[calc(100svh-80px)] items-center justify-center px-4 py-10 md:px-10">
      <div className="w-full max-w-[560px] rounded-2xl border border-rule bg-card px-7 py-9 shadow-card md:px-10 md:py-12">
        <div className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
          {'// Access suspended'}
        </div>
        <h1 className="mb-3 text-[24px] font-extrabold leading-[1.2] tracking-[-0.02em] text-ink md:text-[26px]">
          {headline}
        </h1>
        <p className="mb-5 text-[14.5px] leading-[1.55] text-ink-soft">{body}</p>
        <ul className="mb-7 list-disc pl-5 text-[13.5px] leading-[1.6] text-ink-soft marker:text-rule">
          <li>Your data is safe — nothing is deleted</li>
          <li>Your public site continues to render while you sort billing</li>
          <li>Lead capture forms are temporarily disabled until billing is restored</li>
        </ul>
        {error ? (
          <p className="mb-4 text-[13px] font-semibold text-warn">{error}</p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleUpdatePayment}
            disabled={pending}
            size="lg"
            className="min-w-[180px]"
          >
            {pending ? 'Loading…' : 'Update payment →'}
          </Button>
        </div>
        <p className="mt-7 border-t border-paper-2 pt-5 text-[12px] leading-[1.55] text-ink-quiet">
          Once payment succeeds your access restores automatically — Stripe
          notifies us within seconds. If you have questions, reach out to
          Webnua support.
        </p>
      </div>
    </div>
  );
}

const COPY_BY_REASON: Record<NonNullable<BillingGateResponse['reason']>, string> = {
  past_due_grace_elapsed:
    "Stripe couldn't process your most recent payment, and the 7-day grace window has elapsed. Update your payment method to restore access — Stripe will retry the charge as soon as you save a working card.",
  cancelled:
    'Your subscription has been cancelled. Start a fresh subscription to restore access — your data is preserved.',
};

function humanisePortalError(code: string): string {
  switch (code) {
    case 'unauthenticated':
      return 'Sign in again to manage billing.';
    case 'forbidden':
    case 'forbidden-client':
      return 'You don’t have access to this workspace.';
    case 'stripe-not-configured':
      return 'Billing is not configured. Contact support.';
    case 'no-stripe-customer':
      return 'No billing record found. Contact support.';
    default:
      return `Could not open billing (${code}). Contact support if this keeps happening.`;
  }
}
