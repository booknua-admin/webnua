'use client';

// =============================================================================
// LaunchMetaCampaignModal — operator launch wizard.
//
// Phase 7 Meta Ads. Operator picks a template + a Facebook Page + budget +
// privacy-policy URL + landing URL → POSTs the launch route → the
// orchestrator runs the 5-step Meta API sequence + inserts the campaigns
// + meta_campaigns + meta_lead_forms rows. The campaign is created in
// PAUSED state by default — the operator confirms it in Meta Ads Manager
// before publishing.
//
// Pre-launch checks:
//   • Client must have an ad-account assignment (the post-OAuth picker
//     ran). If not, the modal sends them to /settings/integrations.
//   • Listing FB Pages happens on mount — the operator picks which Page
//     the ad will attach to (lead-gen ads require a Page).
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CAMPAIGN_TEMPLATES,
  type CampaignTemplateSlug,
} from '@/lib/integrations/meta-ads/campaign-templates';
import {
  MetaRouteError,
  useClientMetaAdAccount,
  useLaunchMetaCampaign,
  useListMetaAdAccounts,
} from '@/lib/integrations/meta-ads/use-meta-ads';

type PartialFailure = {
  step?: string;
  detail?: string;
  partial?: Record<string, unknown>;
};

export function LaunchMetaCampaignModal({
  open,
  onOpenChange,
  clientId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}) {
  const adAccount = useClientMetaAdAccount(clientId);
  const list = useListMetaAdAccounts();
  const launch = useLaunchMetaCampaign();

  const [templateSlug, setTemplateSlug] = useState<CampaignTemplateSlug>('electrician');
  const [pageId, setPageId] = useState<string>('');
  const [pageAccessToken, setPageAccessToken] = useState<string>('');
  const [dailyBudgetMajor, setDailyBudgetMajor] = useState<string>('7');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState<string>('');
  const [linkUrl, setLinkUrl] = useState<string>('');
  const [launchActive, setLaunchActive] = useState(false);
  const [failure, setFailure] = useState<PartialFailure | null>(null);

  // Refresh the Pages list every time the modal opens — Page selection
  // can change (customer added a new Page) and the page access token is
  // short-lived enough that we want a fresh one at launch time.
  useEffect(() => {
    if (open && !list.data && !list.isPending) {
      list.mutate({ clientId });
    }
    // Failure-state reset on close lives on the Dialog's onOpenChange
    // (avoids the set-state-in-effect lint rule).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  function handleOpenChange(next: boolean) {
    if (!next) setFailure(null);
    onOpenChange(next);
  }

  const template = CAMPAIGN_TEMPLATES.find((t) => t.slug === templateSlug);
  const pages = list.data?.pages ?? [];
  const budget = parseFloat(dailyBudgetMajor);
  const canLaunch =
    !!template &&
    !!adAccount.data &&
    pageId.length > 0 &&
    pageAccessToken.length > 0 &&
    Number.isFinite(budget) &&
    budget > 0 &&
    privacyPolicyUrl.startsWith('http') &&
    linkUrl.startsWith('http') &&
    !launch.isPending;

  async function handleLaunch() {
    if (!template) return;
    setFailure(null);
    try {
      await launch.mutateAsync({
        clientId,
        templateSlug: template.slug,
        dailyBudgetMajor: budget,
        pageId,
        pageAccessToken,
        privacyPolicyUrl,
        linkUrl,
        initialStatus: launchActive ? 'ACTIVE' : 'PAUSED',
      });
      handleOpenChange(false);
    } catch (err) {
      // The launch route returns a structured failure body when a Meta
      // call fails mid-sequence: { step, detail, partial }. `postJson` in
      // use-meta-ads throws a MetaRouteError carrying those fields so the
      // operator sees which step failed + any Meta-side resources that
      // need cleanup in Ads Manager.
      if (err instanceof MetaRouteError) {
        setFailure({
          step: err.step,
          detail: err.detail ?? err.message,
          partial: err.partial,
        });
      } else {
        setFailure({ detail: err instanceof Error ? err.message : 'Launch failed.' });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="lg"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        {/* Sticky header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <DialogTitle className="mb-1.5 text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
              Launch a Meta lead-gen campaign
            </DialogTitle>
            <p className="text-[13px] leading-[1.45] text-ink-quiet">
              Webnua creates the campaign + ad set + lead form + creative + ad
              on the customer&apos;s Meta ad account.{' '}
              <strong className="text-ink">Defaults to PAUSED</strong> — review
              in Meta Ads Manager before publishing.
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
          {!adAccount.data ? (
            <div className="rounded-md border border-warn bg-warn-soft px-3 py-3 text-[13px] text-warn">
              <strong>No Meta ad account wired.</strong> Connect Meta + pick an
              ad account on <code>/settings/integrations</code> before
              launching.
            </div>
          ) : (
            <>
            {/* Template */}
            <Field
              label="Template"
              hint={template ? template.description : ''}
            >
              <Select
                value={templateSlug}
                onValueChange={(v) => setTemplateSlug(v as CampaignTemplateSlug)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_TEMPLATES.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {t.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Page */}
            <Field label="Facebook Page">
              {list.isPending ? (
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet">
                  {'// Loading pages…'}
                </div>
              ) : pages.length === 0 ? (
                <div className="text-[12px] text-warn">
                  No Pages found. Confirm the customer granted{' '}
                  <code>pages_show_list</code> + <code>pages_manage_ads</code>{' '}
                  during OAuth.
                </div>
              ) : (
                <Select
                  value={pageId}
                  onValueChange={(id) => {
                    setPageId(id);
                    const p = pages.find((pg) => pg.id === id);
                    setPageAccessToken(p?.accessToken ?? '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a Page…" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => (
                      <SelectItem key={p.id ?? ''} value={p.id ?? ''}>
                        {p.name ?? p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            {/* Budget */}
            <Field
              label="Daily budget (major units)"
              hint={
                template
                  ? `Template suggests ${template.suggestedDailyBudgetMajor} / day = ~${
                      template.suggestedDailyBudgetMajor * 30
                    } / month`
                  : ''
              }
            >
              <Input
                type="number"
                step="0.5"
                min="1"
                value={dailyBudgetMajor}
                onChange={(e) => setDailyBudgetMajor(e.target.value)}
              />
            </Field>

            {/* Privacy policy + link URL */}
            <Field
              label="Privacy policy URL"
              hint="Meta requires a privacy-policy URL on every lead form."
            >
              <Input
                type="url"
                value={privacyPolicyUrl}
                onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                placeholder="https://example.com/privacy"
              />
            </Field>
            <Field label="Landing URL" hint="Where the ad's tap goes.">
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com/"
              />
            </Field>

            {/* Pre-launch checklist (from the template). */}
            {template ? (
              <details className="rounded-md border border-dashed border-rule bg-paper px-3 py-2 text-[12px] text-ink-soft">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
                  Pre-launch checklist · {template.preLaunchChecklist.length} items
                </summary>
                <ul className="mt-2 list-disc pl-5 [&_li]:mt-1">
                  {template.preLaunchChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {/* Launch ACTIVE vs PAUSED */}
            <label className="flex items-start gap-2 text-[12px] leading-[1.45] text-ink-soft">
              <input
                type="checkbox"
                checked={launchActive}
                onChange={(e) => setLaunchActive(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Launch in <strong>ACTIVE</strong> state — publishes immediately
                after Meta&apos;s ad review. Off = paused.
              </span>
            </label>

            {failure ? (
              <div className="rounded-md border border-warn bg-warn-soft px-3 py-2 text-[12px] text-warn">
                <div className="font-bold">
                  Launch failed{failure.step ? ` · ${failure.step}` : ''}
                </div>
                <div>{failure.detail}</div>
                {failure.partial ? (
                  <div className="mt-1 font-mono text-[10px] text-ink-quiet">
                    Partial state — clean up in Meta Ads Manager if needed.
                  </div>
                ) : null}
              </div>
            ) : null}
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-paper-2 bg-paper px-7 py-3.5">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLaunch} disabled={!canLaunch}>
            {launch.isPending ? 'Launching…' : 'Launch campaign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-[11px] leading-[1.4] text-ink-quiet">{hint}</p>
      ) : null}
    </div>
  );
}
