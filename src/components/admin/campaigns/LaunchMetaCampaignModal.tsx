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

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
      // call fails mid-sequence (step / detail / partial). useMutation
      // throws an Error whose message is the JSON detail; surface the
      // human-readable bits.
      const message = err instanceof Error ? err.message : 'Launch failed.';
      setFailure({ detail: message });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Launch a Meta lead-gen campaign</DialogTitle>
          <DialogDescription>
            Webnua creates the campaign + ad set + lead form + creative + ad on
            the customer&apos;s Meta ad account. <strong>Defaults to PAUSED</strong> —
            review in Meta Ads Manager before publishing.
          </DialogDescription>
        </DialogHeader>

        {!adAccount.data ? (
          <div className="rounded-md border border-warn bg-warn-soft px-3 py-3 text-[13px] text-warn">
            <strong>No Meta ad account wired.</strong> Connect Meta + pick an ad
            account on <code>/settings/integrations</code> before launching.
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
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
                <div className="font-bold">Launch failed</div>
                <div>{failure.detail}</div>
                {failure.partial ? (
                  <div className="mt-1 font-mono text-[10px] text-ink-quiet">
                    Partial state — clean up in Meta Ads Manager if needed.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLaunch} disabled={!canLaunch}>
            {launch.isPending ? 'Launching…' : 'Launch campaign'}
          </Button>
        </DialogFooter>
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
