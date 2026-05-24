'use client';

// =============================================================================
// MetaConnectPanel — the "Connect Meta ad account" affordance.
//
// Sibling of GbpConnectPanel. Mounted on `/campaigns` (sub-account mode) and
// shown when the client has no Meta ad account wired. Renders the clean empty
// state with a primary CTA that fires the OAuth flow via the existing
// `connectIntegration` helper.
//
// Auth: the underlying connect route allows EITHER a client-role user (for
// their own client) OR an operator (delegated). So this panel works for
// both — operators initiating on behalf of a sub-account, AND clients
// connecting their own ad account directly.
//
// Self-hides when the client already has a wired Meta ad account so it can be
// mounted unconditionally above the rest of the page.
//
// "Already connected? Pick an ad account" handles the case where the OAuth
// grant landed but the post-redirect picker was dismissed before a selection
// was made — opens `MetaAdAccountPickerModal` directly.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { MetaAdAccountPickerModal } from '@/components/shared/settings/MetaAdAccountPickerModal';
import { connectIntegration } from '@/lib/integrations/use-connections';
import { useClientMetaAdAccount } from '@/lib/integrations/meta-ads/use-meta-ads';

export function MetaConnectPanel({
  clientId,
  clientName,
  /** When true, surfaces operator-framing copy ("connect this client's
   *  Meta ad account"). Default false → client-framing ("connect your Meta
   *  ad account"). */
  operatorFraming = false,
}: {
  clientId: string | null;
  clientName?: string;
  operatorFraming?: boolean;
}) {
  const adAccount = useClientMetaAdAccount(clientId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (adAccount.isLoading) {
    return (
      <div className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {'// Checking Meta ad-account connection…'}
      </div>
    );
  }
  if (adAccount.data) {
    return null;
  }

  async function handleConnect() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    try {
      // Resolves only on failure — on success the browser navigates to
      // Meta's consent screen.
      await connectIntegration('meta_ads', clientId);
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
            {'// Meta ads · not connected'}
          </div>
          <h3 className="mb-2 text-[22px] font-extrabold tracking-[-0.01em] text-ink [&_em]:not-italic [&_em]:text-rust">
            Connect {whose} <em>Meta ad account</em>.
          </h3>
          <p className="max-w-[640px] text-[13px] leading-[1.6] text-ink-soft">
            Webnua pulls campaigns + leads + spend from the connected ad
            account, so this page can show live performance and the
            automations can route Meta leads into your inbox.{' '}
            <strong className="font-bold text-ink">Takes about 30 seconds.</strong>
          </p>
          {error ? (
            <p className="mt-3 rounded-md border border-warn/30 bg-warn/8 px-3 py-2 text-[12px] text-warn">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button size="lg" disabled={busy || !clientId} onClick={handleConnect}>
            {busy ? 'Opening Meta…' : 'Connect Meta ads →'}
          </Button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={!clientId}
            className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet transition-colors hover:text-ink disabled:opacity-50"
          >
            Already connected? Pick an ad account
          </button>
        </div>
      </div>
      <MetaAdAccountPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        clientId={clientId}
      />
    </div>
  );
}
