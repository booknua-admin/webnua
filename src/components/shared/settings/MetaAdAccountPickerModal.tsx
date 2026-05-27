'use client';

// =============================================================================
// MetaAdAccountPickerModal — post-OAuth Meta ad-account + Page selection.
//
// Phase 7 Meta Ads. Auto-opens after a successful Meta OAuth callback (the
// `IntegrationConnectionsSection` lifts the URL params and opens this).
// The operator picks WHICH ad account Webnua should manage for the
// customer + WHICH Page lead-gen ads will attach to + acknowledges the
// customer agreement (the customer's email gets recorded as the audit
// trail).
//
// Two-step flow:
//   1. PICK    — choose ad account + Page, capture customer-agreement email
//   2. GRANT   — saving + asset-sharing in progress (or the result of it).
//                Success shows per-asset confirmation lines; partial /
//                full failure shows what failed + a retry affordance.
//
// Sibling of `GbpLocationPickerModal` — same overall shape (list → pick →
// save) but with the additional customer-agreement field + the
// Webnua-BM partner-share step (migration 0113). Partner sharing is what
// makes the customer's assets appear natively in operator Ads Managers;
// the OAuth alone only grants the APP API permission.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

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
  type SharePartnerResponse,
  type ShareOutcomeDto,
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
  const [pickedAdAccountId, setPickedAdAccountId] = useState<string | null>(null);
  const [pickedPageId, setPickedPageId] = useState<string | null>(null);
  const [agreementEmail, setAgreementEmail] = useState('');
  const [agreementAcknowledged, setAgreementAcknowledged] = useState(false);
  const [partnerResult, setPartnerResult] = useState<SharePartnerResponse | null>(null);

  // Auto-list on open so the operator doesn't see an empty modal first.
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
      setPickedAdAccountId(null);
      setPickedPageId(null);
      setAgreementEmail('');
      setAgreementAcknowledged(false);
      setPartnerResult(null);
      selectMutation.reset();
    }
    onOpenChange(next);
  }

  const accounts = listMutation.data?.adAccounts ?? [];
  const pages = listMutation.data?.pages ?? [];

  const pickedPageName = useMemo(() => {
    const p = pages.find((p) => p.id === pickedPageId);
    return p?.name ?? null;
  }, [pages, pickedPageId]);

  const canSave =
    pickedAdAccountId != null &&
    agreementAcknowledged &&
    agreementEmail.includes('@') &&
    !!clientId &&
    !selectMutation.isPending;

  async function handleSave() {
    if (!pickedAdAccountId || !clientId) return;
    const result = await selectMutation.mutateAsync({
      clientId,
      adAccountId: pickedAdAccountId,
      customerAgreementEmail: agreementEmail.trim(),
      pageId: pickedPageId,
      pageName: pickedPageName,
    });
    setPartnerResult(result.partner);
    onSelected?.();
    // Modal stays open on the result screen so the operator sees the
    // per-asset partner-share outcome. They close manually.
  }

  // Once partnerResult is set we're in the "result" phase — show
  // per-asset confirmation instead of the picker form.
  if (partnerResult) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          size="default"
          showCloseButton={false}
          className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
            <div className="flex-1">
              <DialogTitle className="mb-1.5 text-[20px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
                {everyAssetActive(partnerResult) ? 'Webnua is now wired up' : 'Partial setup'}
              </DialogTitle>
              <p className="text-[13px] leading-[1.45] text-ink-quiet">
                {everyAssetActive(partnerResult) ? (
                  <>
                    The customer&apos;s ad account
                    {hasPage(partnerResult) ? ' and Page ' : ' '}
                    {hasPage(partnerResult) ? 'are' : 'is'} now visible in your own
                    Meta Ads Manager. You can build campaigns there directly.
                  </>
                ) : (
                  <>
                    The selection saved. Webnua&apos;s Business Manager partner
                    access didn&apos;t fully succeed — the customer can still use
                    the integration but operators won&apos;t see their assets
                    natively until the share is retried below.
                  </>
                )}
              </p>
            </div>
            <DialogPrimitive.Close
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-7 py-5">
            <PartnerOutcomeRow
              label="Ad account access"
              outcome={partnerResult.adAccount}
            />
            <PartnerOutcomeRow
              label="Page access"
              outcome={partnerResult.page}
            />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-paper-2 bg-paper px-7 py-3.5">
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
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
              Pick a Meta ad account + Page
            </DialogTitle>
            <p className="text-[13px] leading-[1.45] text-ink-quiet">
              Webnua will manage campaigns on this ad account. The customer
              agrees that{' '}
              <strong className="text-ink">Meta bills their card directly</strong>{' '}
              for ad spend, and that{' '}
              <strong className="text-ink">Webnua manages campaigns on their behalf</strong>.
              We&apos;ll also add Webnua&apos;s Business Manager as a partner so
              your team sees the customer&apos;s assets in your own Ads Manager.
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
          {/* Ad-account list */}
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
              {'// Ad account'}
            </div>
            <div className="flex max-h-[180px] flex-col gap-2 overflow-y-auto">
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
                  {'// No ad accounts found. Confirm the customer granted ads_management.'}
                </div>
              ) : (
                accounts.map((acct) => (
                  <button
                    key={acct.id}
                    type="button"
                    onClick={() => setPickedAdAccountId(acct.id ?? null)}
                    data-selected={pickedAdAccountId === acct.id || undefined}
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
                    {pickedAdAccountId === acct.id ? (
                      <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-rust">
                        ✓ picked
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Page list — required for lead-gen ads */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
                {'// Facebook Page (for lead-gen ads)'}
              </div>
              {pickedPageId ? (
                <button
                  type="button"
                  onClick={() => setPickedPageId(null)}
                  className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet underline-offset-2 hover:underline"
                >
                  Skip Page
                </button>
              ) : null}
            </div>
            <div className="flex max-h-[160px] flex-col gap-2 overflow-y-auto">
              {listMutation.isPending ? null : pages.length === 0 ? (
                <div className="rounded-md border border-dashed border-rule bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  {'// No Pages found. The customer can add one later in Meta.'}
                </div>
              ) : (
                pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setPickedPageId(page.id ?? null)}
                    data-selected={pickedPageId === page.id || undefined}
                    className="flex items-center justify-between rounded-md border border-rule bg-card px-3 py-2.5 text-left transition hover:border-rust data-[selected]:border-rust data-[selected]:bg-rust-soft"
                  >
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold text-ink">
                        {page.name ?? 'Unnamed Page'}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
                        {page.id}
                      </div>
                    </div>
                    {pickedPageId === page.id ? (
                      <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-rust">
                        ✓ picked
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
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
              audit trail for both consents above.
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
              directly for ad spend and (b) Webnua managing campaigns on
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
            {selectMutation.isPending
              ? 'Granting Webnua access…'
              : 'Wire to Webnua'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- result-screen helpers ---------------------------------------------------

function PartnerOutcomeRow({
  label,
  outcome,
}: {
  label: string;
  outcome: ShareOutcomeDto;
}) {
  if (outcome.kind === 'skipped') {
    return (
      <div className="rounded-md border border-dashed border-rule bg-paper/70 px-3 py-2.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
          {label}
        </div>
        <div className="mt-0.5 text-[13px] text-ink-quiet">
          {outcome.reason}
        </div>
      </div>
    );
  }
  if (outcome.kind === 'active') {
    return (
      <div className="rounded-md border border-good bg-good-soft px-3 py-2.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-good">
          {label} · active
        </div>
        <div className="mt-0.5 text-[13px] text-ink-soft">
          Webnua&apos;s Business Manager has partner access. You&apos;ll see
          this in your own Meta Ads Manager.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-warn bg-warn-soft px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-warn">
        {label} · failed
      </div>
      <div className="mt-0.5 text-[13px] text-warn">{outcome.reason}</div>
      <div className="mt-1 text-[11px] text-ink-quiet">
        Close this and click <strong>Retry partner access</strong> on the
        connection footer.
      </div>
    </div>
  );
}

function everyAssetActive(p: SharePartnerResponse): boolean {
  const adOk = p.adAccount.kind === 'active';
  const pageOk = p.page.kind === 'active' || p.page.kind === 'skipped';
  return adOk && pageOk;
}

function hasPage(p: SharePartnerResponse): boolean {
  return p.page.kind !== 'skipped';
}
