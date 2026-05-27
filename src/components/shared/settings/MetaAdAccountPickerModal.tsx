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
// Three-step wizard (matches the CreateClientModal pattern):
//   1. ad-account  — pick which ad account to wire
//   2. page        — pick the Facebook Page (or skip if none applies)
//   3. confirm     — capture customer agreement + acknowledgement + submit
//
// Two terminal phases after submit:
//   • granting — the inline asset-share orchestrator is running
//   • result   — per-asset outcome (ad-account share + page share, each
//                independently `active` / `failed` / `skipped`)
//
// Sibling of `GbpLocationPickerModal` — the partner-share step
// (migration 0113) is what surfaces customer assets natively in
// operator Ads Managers; OAuth alone only grants the APP API permission.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  useListMetaAdAccounts,
  useSelectMetaAdAccount,
  type SharePartnerResponse,
  type ShareOutcomeDto,
} from '@/lib/integrations/meta-ads/use-meta-ads';

// --- step model --------------------------------------------------------------

type Step = 'ad-account' | 'page' | 'confirm';

const STEPS: readonly Step[] = ['ad-account', 'page', 'confirm'] as const;

const STEP_SHORT_LABEL: Record<Step, string> = {
  'ad-account': 'Ad account',
  page: 'Page',
  confirm: 'Confirm',
};

const STEP_TITLE: Record<Step, string> = {
  'ad-account': 'Pick the ad account',
  page: 'Pick a Facebook Page',
  confirm: 'Confirm and grant access',
};

// During the mutation we render a static "granting" body so the operator
// sees progress framing rather than a disabled-button-only signal.
type Phase = Step | 'granting' | 'result';

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
  const [phase, setPhase] = useState<Phase>('ad-account');
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
      setPhase('ad-account');
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

  const pickedAdAccount = useMemo(
    () => accounts.find((a) => a.id === pickedAdAccountId) ?? null,
    [accounts, pickedAdAccountId],
  );
  const pickedPage = useMemo(
    () => pages.find((p) => p.id === pickedPageId) ?? null,
    [pages, pickedPageId],
  );

  const stepIndex = phase === 'granting' || phase === 'result'
    ? STEPS.length
    : STEPS.indexOf(phase);

  function goBack() {
    if (phase === 'ad-account') return handleOpenChange(false);
    if (phase === 'page') return setPhase('ad-account');
    if (phase === 'confirm') return setPhase('page');
  }

  function goNext() {
    if (phase === 'ad-account') return setPhase('page');
    if (phase === 'page') return setPhase('confirm');
  }

  async function handleSubmit() {
    if (!pickedAdAccountId || !clientId) return;
    setPhase('granting');
    try {
      const response = await selectMutation.mutateAsync({
        clientId,
        adAccountId: pickedAdAccountId,
        customerAgreementEmail: agreementEmail.trim(),
        pageId: pickedPageId,
        pageName: pickedPage?.name ?? null,
      });
      setPartnerResult(response.partner);
      setPhase('result');
      onSelected?.();
    } catch {
      // The mutation's error is surfaced inline on the confirm step;
      // bounce back so the operator can correct + retry.
      setPhase('confirm');
    }
  }

  const continueDisabled =
    (phase === 'ad-account' && !pickedAdAccountId) ||
    (phase === 'confirm' &&
      (!agreementAcknowledged || !agreementEmail.includes('@') || selectMutation.isPending));

  // --- header content ---
  const headerTitle =
    phase === 'granting'
      ? 'Granting Webnua access…'
      : phase === 'result'
      ? partnerResult && everyAssetActive(partnerResult)
        ? 'Webnua is now wired up'
        : 'Partial setup'
      : STEP_TITLE[phase];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="default"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <DialogTitle className="sr-only">Pick a Meta ad account and Page</DialogTitle>
        <DialogDescription className="sr-only">
          Configure which ad account and Facebook Page Webnua manages for this
          customer, then capture the customer&apos;s consent.
        </DialogDescription>

        {/* Sticky header */}
        <div className="shrink-0 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
                  {'// META ADS'}
                </p>
                {phase !== 'granting' && phase !== 'result' ? (
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                    Step {stepIndex + 1} of {STEPS.length} · {STEP_SHORT_LABEL[phase]}
                  </p>
                ) : null}
              </div>
              <p className="mt-1 text-[20px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
                {headerTitle}
              </p>
            </div>
            <DialogPrimitive.Close
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 font-mono text-[16px] text-ink-quiet transition-colors hover:bg-ink hover:text-paper"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>

          {phase !== 'granting' && phase !== 'result' ? (
            <div
              className="mt-3.5 flex gap-1"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-valuenow={stepIndex + 1}
              aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
            >
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'h-0.5 flex-1 rounded-full transition-colors duration-300',
                    i <= stepIndex ? 'bg-rust' : 'bg-paper-2',
                  )}
                  aria-hidden
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Body — keyed on phase so tailwindcss-animate fade plays per step */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-7 py-5">
          <div key={phase} className="flex flex-1 flex-col gap-4 animate-in fade-in-0 duration-200">

            {phase === 'ad-account' ? (
              <AdAccountStep
                accounts={accounts}
                pickedId={pickedAdAccountId}
                onPick={setPickedAdAccountId}
                loading={listMutation.isPending}
                error={listMutation.error as Error | null}
              />
            ) : null}

            {phase === 'page' ? (
              <PageStep
                pages={pages}
                pickedId={pickedPageId}
                onPick={setPickedPageId}
                loading={listMutation.isPending}
              />
            ) : null}

            {phase === 'confirm' ? (
              <ConfirmStep
                adAccountName={pickedAdAccount?.name ?? pickedAdAccountId ?? '—'}
                adAccountId={pickedAdAccountId ?? '—'}
                pageName={pickedPage?.name ?? null}
                pageId={pickedPageId}
                email={agreementEmail}
                onEmailChange={setAgreementEmail}
                acknowledged={agreementAcknowledged}
                onAcknowledgedChange={setAgreementAcknowledged}
                error={selectMutation.error as Error | null}
                disabled={selectMutation.isPending}
              />
            ) : null}

            {phase === 'granting' ? <GrantingPhase /> : null}

            {phase === 'result' && partnerResult ? (
              <ResultPhase result={partnerResult} />
            ) : null}

          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-paper-2 bg-paper px-7 py-3.5">
          {phase === 'result' ? (
            <>
              <div />
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </>
          ) : phase === 'granting' ? (
            <>
              <div />
              <Button disabled>Granting Webnua access…</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={goBack}>
                {phase === 'ad-account' ? 'Cancel' : '← Back'}
              </Button>

              <div className="flex items-center gap-2">
                {phase === 'page' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPickedPageId(null);
                      setPhase('confirm');
                    }}
                  >
                    Skip page
                  </Button>
                ) : null}
                {phase === 'confirm' ? (
                  <Button onClick={handleSubmit} disabled={continueDisabled}>
                    Wire to Webnua
                  </Button>
                ) : (
                  <Button
                    onClick={goNext}
                    disabled={continueDisabled || (phase === 'page' && !pickedPageId)}
                  >
                    Continue →
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- step bodies -------------------------------------------------------------

function AdAccountStep({
  accounts,
  pickedId,
  onPick,
  loading,
  error,
}: {
  accounts: ReturnType<typeof useListMetaAdAccounts>['data'] extends infer T
    ? T extends { adAccounts: infer A }
      ? A
      : never
    : never;
  pickedId: string | null;
  onPick: (id: string | null) => void;
  loading: boolean;
  error: Error | null;
}) {
  return (
    <>
      <p className="text-[13px] leading-[1.45] text-ink-quiet">
        Webnua will manage campaigns on this ad account. The customer agrees
        that <strong className="text-ink">Meta bills their card directly</strong>{' '}
        for ad spend.
      </p>
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
            {'// Loading ad accounts…'}
          </div>
        ) : error ? (
          <div className="rounded-md border border-warn bg-warn-soft px-3 py-2 text-[13px] text-warn">
            {error.message}
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
              onClick={() => onPick(acct.id ?? null)}
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
    </>
  );
}

function PageStep({
  pages,
  pickedId,
  onPick,
  loading,
}: {
  pages: ReturnType<typeof useListMetaAdAccounts>['data'] extends infer T
    ? T extends { pages: infer P }
      ? P
      : never
    : never;
  pickedId: string | null;
  onPick: (id: string | null) => void;
  loading: boolean;
}) {
  return (
    <>
      <p className="text-[13px] leading-[1.45] text-ink-quiet">
        Lead-gen ads attach to a Facebook Page. Webnua&apos;s Business Manager
        will be added as a partner on this Page too so your team can run and
        edit those ads.
      </p>
      <div className="flex flex-col gap-2">
        {loading ? null : pages.length === 0 ? (
          <div className="rounded-md border border-dashed border-rule bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
            {'// No Pages found. Use "Skip page" — the customer can wire one later in Meta.'}
          </div>
        ) : (
          pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => onPick(page.id ?? null)}
              data-selected={pickedId === page.id || undefined}
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
              {pickedId === page.id ? (
                <div className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-rust">
                  ✓ picked
                </div>
              ) : null}
            </button>
          ))
        )}
      </div>
    </>
  );
}

function ConfirmStep({
  adAccountName,
  adAccountId,
  pageName,
  pageId,
  email,
  onEmailChange,
  acknowledged,
  onAcknowledgedChange,
  error,
  disabled,
}: {
  adAccountName: string;
  adAccountId: string;
  pageName: string | null;
  pageId: string | null;
  email: string;
  onEmailChange: (s: string) => void;
  acknowledged: boolean;
  onAcknowledgedChange: (b: boolean) => void;
  error: Error | null;
  disabled: boolean;
}) {
  return (
    <>
      {/* Summary of picks */}
      <div className="rounded-md border border-rule bg-paper/70 px-3 py-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-quiet">
          You picked
        </div>
        <div className="mt-1.5 grid gap-1.5 text-[13px]">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet w-[80px] shrink-0">
              Ad account
            </span>
            <span className="text-ink">
              <strong className="font-bold">{adAccountName}</strong>{' '}
              <span className="font-mono text-[11px] text-ink-quiet">{adAccountId}</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet w-[80px] shrink-0">
              Page
            </span>
            <span className="text-ink">
              {pageId ? (
                <>
                  <strong className="font-bold">{pageName ?? pageId}</strong>{' '}
                  <span className="font-mono text-[11px] text-ink-quiet">{pageId}</span>
                </>
              ) : (
                <span className="text-ink-quiet">No Page — skipped</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Customer agreement */}
      <div>
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
          Customer agreement email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="customer@example.com"
          disabled={disabled}
        />
        <p className="mt-1 text-[11px] leading-[1.4] text-ink-quiet">
          The customer&apos;s email is recorded with this selection as the
          audit trail for the consents below.
        </p>
      </div>
      <label className="flex items-start gap-2 text-[12px] leading-[1.45] text-ink-soft">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledgedChange(e.target.checked)}
          className="mt-0.5"
          disabled={disabled}
        />
        <span>
          I confirm the customer agreed to (a) Meta billing their card
          directly for ad spend and (b) Webnua managing campaigns on
          their behalf.
        </span>
      </label>
      {error ? (
        <div className="rounded-md border border-warn bg-warn-soft px-3 py-2 text-[12px] text-warn">
          {error.message}
        </div>
      ) : null}
    </>
  );
}

// --- granting + result phases -----------------------------------------------

function GrantingPhase() {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-paper-2 border-t-rust"
          aria-hidden
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          {'// Granting'}
        </p>
        <p className="max-w-[320px] text-[13px] leading-[1.45] text-ink-soft">
          Saving your selection and adding Webnua&apos;s Business Manager as a
          partner on the customer&apos;s assets.
        </p>
      </div>
    </div>
  );
}

function ResultPhase({ result }: { result: SharePartnerResponse }) {
  const all = everyAssetActive(result);
  return (
    <>
      <p className="text-[13px] leading-[1.45] text-ink-quiet">
        {all ? (
          <>
            The customer&apos;s ad account
            {hasPage(result) ? ' and Page ' : ' '}
            {hasPage(result) ? 'are' : 'is'} now visible in your own Meta
            Ads Manager. You can build campaigns there directly.
          </>
        ) : (
          <>
            The selection saved. Webnua&apos;s Business Manager partner
            access didn&apos;t fully succeed — the customer can still use
            the integration but operators won&apos;t see their assets
            natively until the share is retried from the connection footer.
          </>
        )}
      </p>
      <div className="flex flex-col gap-3">
        <PartnerOutcomeRow label="Ad account access" outcome={result.adAccount} />
        <PartnerOutcomeRow label="Page access" outcome={result.page} />
      </div>
    </>
  );
}

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
        <div className="mt-0.5 text-[13px] text-ink-quiet">{outcome.reason}</div>
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
