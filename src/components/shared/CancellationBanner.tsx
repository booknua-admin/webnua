'use client';

// =============================================================================
// CancellationBanner — Pattern B two-stage cancellation, customer-facing
// high-visibility notice.
//
// Mounted on /dashboard for any client in 'cancelled' lifecycle state. The
// banner:
//   - Tells the customer their account was cancelled
//   - Shows days remaining until soft-delete (the Stage 1 → Stage 2
//     transition at day 30)
//   - Surfaces a primary "Reactivate" CTA that hits /api/clients/[id]/
//     reactivate → mints a Stripe Checkout session → opens hosted Stripe
//     → on success the webhook reactivates (flips back to 'active' +
//     clears the cancellation timestamps)
//
// Visual: warn-tinted (rust-soft via existing tokens). High enough to be
// unmissable; not so noisy that it feels broken. CLAUDE.md compliance: no
// emojis. Mobile-friendly — stacks the actions vertically below md.
//
// Not used for 'deleted' state — that lifecycle locks the dashboard out
// entirely (`dashboardIsAccessible` returns false). The dashboard route
// handles that case separately.
// =============================================================================

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { daysUntilDeletion } from '@/lib/billing/cancellation';
import { supabase } from '@/lib/supabase/client';

type CancellationBannerProps = {
  /** UUID of the client. */
  clientId: string;
  /** Display name for the headline. */
  clientName: string;
};

type CancellationState = {
  cancelledAt: string | null;
  dataDeletionScheduledAt: string | null;
};

export function CancellationBanner({
  clientId,
  clientName,
}: CancellationBannerProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CancellationState>({
    cancelledAt: null,
    dataDeletionScheduledAt: null,
  });

  // Self-fetch the cancellation timestamps — keeps the dashboard /
  // clients-store free of cancellation-specific columns (only mounted for
  // 'cancelled' clients, which is rare). Re-fetches on clientId change.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('clients')
        .select('cancelled_at, data_deletion_scheduled_at')
        .eq('id', clientId)
        .maybeSingle();
      if (cancelled) return;
      const row = data as
        | { cancelled_at: string | null; data_deletion_scheduled_at: string | null }
        | null;
      if (row) {
        setState({
          cancelledAt: row.cancelled_at,
          dataDeletionScheduledAt: row.data_deletion_scheduled_at,
        });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const { cancelledAt, dataDeletionScheduledAt } = state;
  const daysRemaining = daysUntilDeletion(dataDeletionScheduledAt);
  const cancelledAtDisplay = cancelledAt ? formatShortDate(cancelledAt) : null;

  async function handleReactivate() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/clients/${clientId}/reactivate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(humaniseReactivateError(body.error ?? `${res.status}`));
        setPending(false);
        return;
      }
      const body = (await res.json()) as { ok?: boolean; url?: string };
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      // Server returned success but no Checkout URL — refresh to pick up
      // any state change.
      window.location.reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(`Could not start reactivation: ${message}`);
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-warn bg-warn/[0.08] px-5 py-4 md:px-6 md:py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0">
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
            {'// Account cancelled'}
          </div>
          <div className="text-[16px] leading-[1.3] font-extrabold tracking-[-0.01em] text-ink md:text-[17px]">
            Your <strong>{clientName}</strong> subscription was cancelled
            {cancelledAtDisplay ? <> on <strong>{cancelledAtDisplay}</strong></> : null}.
          </div>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-ink-soft">
            {daysRemainingCopy(daysRemaining)}
          </p>
          {error ? (
            <p className="mt-2 text-[13px] font-semibold text-warn">{error}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:items-start">
          <Button
            onClick={handleReactivate}
            disabled={pending}
            size="lg"
            className="min-w-[150px]"
          >
            {pending ? 'Loading…' : 'Reactivate →'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function daysRemainingCopy(days: number | null): string {
  if (days === null) {
    return "Reactivate any time to keep your data. We'll restore your workspace exactly as it was.";
  }
  if (days <= 0) {
    return "Your data is being moved to operator-only recovery today. Reactivate now to keep full self-serve access.";
  }
  if (days === 1) {
    return "Your data will move to operator-only recovery in 1 day. Reactivate now to keep full access.";
  }
  return `Your data will move to operator-only recovery in ${days} days. Reactivate any time before then to keep full self-serve access.`;
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function humaniseReactivateError(code: string): string {
  switch (code) {
    case 'unauthenticated':
      return 'Sign in again to reactivate.';
    case 'forbidden':
    case 'forbidden-client':
      return 'You don’t have access to this workspace.';
    case 'stripe-not-configured':
      return 'Billing is not configured. Contact support.';
    case 'no-price-configured':
      return 'No billing plan available right now. Contact support.';
    case 'no-stripe-customer':
      return 'Use the standard subscribe flow on this workspace.';
    case 'deleted-recovery-operator-only':
      return 'This account is past the self-serve grace window. Contact support to restore.';
    case 'not-cancelled':
      return 'This workspace is not currently cancelled.';
    case 'checkout-failed':
      return 'Could not reach Stripe. Try again in a moment.';
    default:
      return `Could not start reactivation (${code}).`;
  }
}
