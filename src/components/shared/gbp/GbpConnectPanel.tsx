'use client';

// =============================================================================
// GbpConnectPanel — the "Connect Google Business Profile" affordance.
//
// Phase 7 GBP UI consolidation. Mounted on `/reviews` (both client + operator
// contexts) and shown when the client has no GBP location connected. Renders
// a clean empty state with a primary CTA that fires the OAuth flow via the
// existing `connectIntegration` helper.
//
// Auth: the underlying connect route allows EITHER a client-role user (for
// their own client) OR an operator (delegated). So this panel works for
// both — operators initiating on behalf of a sub-account, AND clients
// connecting their own listing directly.
//
// Self-hides when the client already has a connected GBP location, so it can
// be mounted unconditionally above the existing reviews UI.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { GbpLocationPickerModal } from '@/components/shared/settings/GbpLocationPickerModal';
import { connectIntegration } from '@/lib/integrations/use-connections';
import { useClientGbpLocation } from '@/lib/integrations/gbp/use-gbp';

export function GbpConnectPanel({
  clientId,
  clientName,
  /** When true, surfaces operator-framing copy ("connect this client's
   *  GBP"). Default false → client-framing ("connect your GBP"). */
  operatorFraming = false,
}: {
  clientId: string | null;
  clientName?: string;
  operatorFraming?: boolean;
}) {
  const location = useClientGbpLocation(clientId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Resolved + connected → nothing to show. The parent renders the reviews
  // list as-is.
  if (location.isLoading) {
    return (
      <div className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Checking Google Business connection…'}
      </div>
    );
  }
  if (location.data) {
    return null;
  }

  async function handleConnect() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      // Resolves only on failure — on success the browser navigates to
      // Google's consent screen.
      await connectIntegration('google_business_profile', clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the connection.');
      setBusy(false);
    }
  }

  const whose = operatorFraming
    ? clientName
      ? `${clientName}'s`
      : `this client's`
    : 'your';

  return (
    <div className="rounded-xl border border-rule bg-card px-7 py-8">
      <div className="grid grid-cols-[1fr_auto] items-center gap-7">
        <div>
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            // Google Business Profile · not connected
          </div>
          <h3 className="mb-2 text-[22px] font-extrabold tracking-[-0.01em] text-ink [&_em]:not-italic [&_em]:text-rust">
            Connect {whose} <em>Google Business Profile</em>.
          </h3>
          <p className="max-w-[640px] text-[13px] leading-[1.6] text-ink-soft">
            Webnua syncs reviews daily, sends a review-request SMS or email
            after every completed job, and lets {operatorFraming ? 'you' : 'you'}
            {' '}reply to reviews from here — without leaving the platform.
            {' '}<strong className="font-bold text-ink">Takes about 30 seconds.</strong>
          </p>
          {error ? (
            <p className="mt-3 rounded-md border border-warn/30 bg-warn/8 px-3 py-2 text-[12px] text-warn">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            size="lg"
            disabled={busy || !clientId}
            onClick={handleConnect}
          >
            {busy ? 'Opening Google…' : 'Connect Google Business →'}
          </Button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!clientId}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet transition-colors hover:text-ink disabled:opacity-50"
          >
            Already connected? Pick a location
          </button>
        </div>
      </div>
      <GbpLocationPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clientId={clientId}
      />
    </div>
  );
}
