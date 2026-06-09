'use client';

// =============================================================================
// MetaAdAccountPickerModal — post-OAuth Meta ad-account selection.
//
// Phase 7 Meta Ads. Auto-opens after a successful Meta OAuth callback (the
// `IntegrationConnectionsSection` lifts the URL params and opens this).
// The customer or operator picks WHICH ad account Webnua should work with
// for this client, then records the customer agreement email as the audit
// trail.
//
// Sibling of `GbpLocationPickerModal` — same overall flow shape (list →
// pick → save) but with the additional customer-agreement field; the
// Meta integration's commercial agreement (Meta billing the customer's
// card for ad spend; Webnua managing campaigns) is a higher-stakes
// consent than picking a GBP location.
// =============================================================================

import { useEffect, useState } from 'react';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useListMetaAdAccounts,
  useSelectMetaAdAccount,
} from '@/lib/integrations/meta-ads/use-meta-ads';

export function MetaAdAccountPickerModal({
  open,
  onOpenChange,
  clientId,
  onSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | null;
  onSelected?: () => void;
}) {
  const listMutation = useListMetaAdAccounts();
  const selectMutation = useSelectMetaAdAccount();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [agreementEmail, setAgreementEmail] = useState('');
  const [agreementAcknowledged, setAgreementAcknowledged] = useState(false);

  // Auto-list on open so the picker doesn't show an empty modal first.
  useEffect(() => {
    if (open && clientId && !listMutation.data && !listMutation.isPending) {
      listMutation.mutate({ clientId });
    }
    // Form reset on close lives on the Dialog's onOpenChange to avoid the
    // set-state-in-effect lint rule (cascading-render anti-pattern).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPickedId(null);
      setAgreementEmail('');
      setAgreementAcknowledged(false);
    }
    onOpenChange(next);
  }

  const accounts = listMutation.data?.adAccounts ?? [];
  const canSave =
    pickedId != null &&
    agreementAcknowledged &&
    agreementEmail.includes('@') &&
    !!clientId &&
    !selectMutation.isPending;

  async function handleSave() {
    if (!pickedId || !clientId) return;
    await selectMutation.mutateAsync({
      clientId,
      adAccountId: pickedId,
      customerAgreementEmail: agreementEmail.trim(),
    });
    onSelected?.();
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="default"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        {/* Sticky header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <DialogTitle className="mb-1.5 text-[20px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
              Choose the Meta ad account to connect
            </DialogTitle>
            <p className="text-[13px] leading-[1.45] text-ink-quiet">
              Pick the ad account Webnua should use for this business. The
              customer agrees that <strong className="text-ink">Meta bills
              their card directly</strong> for ad spend, and that{' '}
              <strong className="text-ink">Webnua can manage campaigns on
              their behalf</strong>.
            </p>
          </div>
          <DialogPrimitive.Close
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        </div>

        {/* Scrollable body */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-7 py-5">
          {/* Ad-account list — bounded so the rest of the modal chrome (agreement
             email + acknowledgement) stays visible on a short viewport. ~3 rows
             visible; the list scrolls within itself. */}
          <div className="flex max-h-[230px] flex-col gap-2 overflow-y-auto">
            {listMutation.isPending ? (
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                {'// Loading ad accounts…'}
              </div>
            ) : listMutation.error ? (
              <div className="rounded-md border border-warn bg-warn-soft px-3 py-2 text-[13px] text-warn">
                {(listMutation.error as Error).message}
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-md border border-dashed border-rule bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                {'// No ad accounts found. Confirm the Meta login has access to the right business assets.'}
              </div>
            ) : (
              accounts.map((acct) => (
                <button
                  key={acct.id}
                  type="button"
                  onClick={() => setPickedId(acct.id ?? null)}
                  data-selected={pickedId === acct.id || undefined}
                  className="flex items-center justify-between rounded-md border border-rule bg-card px-3 py-2.5 text-left transition hover:border-rust data-[selected]:border-rust data-[selected]:bg-rust-soft"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-ink">
                      {acct.name ?? 'Unnamed ad account'}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
                      {acct.id} · {acct.currency ?? '—'} · {acct.statusLabel ?? '—'}
                      {acct.business?.name ? ` · ${acct.business.name}` : ''}
                    </div>
                  </div>
                  {pickedId === acct.id ? (
                    <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-rust">
                      ✓ picked
                    </div>
                  ) : null}
                </button>
              ))
            )}
          </div>

          {/* Customer agreement */}
          <div className="border-t border-paper-2 pt-4">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
              Customer agreement email
            </label>
            <Input
              type="email"
              value={agreementEmail}
              onChange={(e) => setAgreementEmail(e.target.value)}
              placeholder="customer@example.com"
              disabled={selectMutation.isPending}
            />
            <p className="mt-1 text-[11px] leading-[1.4] text-ink-quiet">
              The customer&apos;s email is recorded with this selection as the
              audit trail for those permissions.
            </p>
          </div>
          <label className="flex items-start gap-2 text-[12px] leading-[1.45] text-ink-soft">
            <input
              type="checkbox"
              checked={agreementAcknowledged}
              onChange={(e) => setAgreementAcknowledged(e.target.checked)}
              className="mt-0.5"
              disabled={selectMutation.isPending}
            />
            <span>
              I confirm the customer agreed to (a) Meta billing their card
              directly for ad spend and (b) Webnua managing campaigns
              their behalf.
            </span>
          </label>
          {selectMutation.error ? (
            <div className="rounded-md border border-warn bg-warn-soft px-3 py-2 text-[12px] text-warn">
              {(selectMutation.error as Error).message}
            </div>
          ) : null}
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-paper-2 bg-paper px-7 py-3.5">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {selectMutation.isPending ? 'Saving…' : 'Save ad account'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
