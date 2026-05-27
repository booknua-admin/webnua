'use client';

// =============================================================================
// MetaPermissionRationaleModal — pre-OAuth consent-rationale screen.
//
// Meta App Review evaluates whether the user is *informed* before granting
// access. Surfacing a clear "here is exactly what we'll request and why"
// screen on our side ahead of Meta's own consent dialog is one of the
// concrete moves that helps approval odds, and operators consistently
// report fewer customer drop-offs at the OAuth screen when this layer
// exists (the customer knows what they are agreeing to before they hit
// the unfamiliar Meta dialog).
//
// Opens from the Meta Connect button on IntegrationConnectionsSection;
// "Continue to Facebook" fires the actual `connectIntegration()` call
// that redirects to Meta's OAuth flow.
// =============================================================================

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { FacebookConnectButton } from './FacebookConnectButton';

// The permissions Webnua's Meta OAuth client requests. Each entry is the
// scope name + a single sentence the customer reads BEFORE Meta's own
// consent screen. Keep these in lockstep with the actual scopes set in
// the OAuth provider config (src/lib/integrations/_shared/oauth-providers.ts
// → metaAdsProvider.scopes).
const PERMISSION_RATIONALES: readonly { scope: string; label: string; rationale: string }[] = [
  {
    scope: 'public_profile',
    label: 'Your public profile',
    rationale: 'So Webnua can identify your Facebook account.',
  },
  {
    scope: 'email',
    label: 'Your email address',
    rationale: 'Same — Webnua uses this to identify and contact you about ad activity.',
  },
  {
    scope: 'business_management',
    label: 'Manage your Business Manager assets',
    rationale:
      'So Webnua’s Business Manager can be added as a partner on your assets — that’s how your operator sees your ad account in their own Meta Ads Manager.',
  },
  {
    scope: 'ads_management',
    label: 'Manage your ads',
    rationale: 'So Webnua can create, pause, and edit ad campaigns on your ad account.',
  },
  {
    scope: 'ads_read',
    label: 'Read your ad performance',
    rationale: 'So Webnua can show you results — leads, spend, cost-per-lead — in your dashboard.',
  },
  {
    scope: 'pages_show_list',
    label: 'See the Facebook Pages you manage',
    rationale: 'So you can pick which Page lead-generation ads attach to.',
  },
  {
    scope: 'pages_manage_ads',
    label: 'Run ads on the chosen Page',
    rationale: 'So Webnua can launch lead-gen ads attached to the Page you select.',
  },
  {
    scope: 'leads_retrieval',
    label: 'Retrieve leads from your ads',
    rationale: 'So submitted leads land in your Webnua inbox automatically.',
  },
];

export function MetaPermissionRationaleModal({
  open,
  onOpenChange,
  onContinue,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="default"
        showCloseButton={false}
        className="flex max-h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-[14px] border-rule bg-card p-0 gap-0"
      >
        <DialogTitle className="sr-only">
          Before you continue to Facebook
        </DialogTitle>
        <DialogDescription className="sr-only">
          A summary of the permissions Webnua will request when you continue
          to the Facebook consent screen.
        </DialogDescription>

        {/* Sticky header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-paper-2 px-7 pb-4 pt-5.5">
          <div className="flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-rust">
              {'// BEFORE YOU CONTINUE'}
            </p>
            <p className="mt-1 text-[20px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">
              What Webnua will ask Facebook for
            </p>
            <p className="mt-1 text-[13px] leading-[1.45] text-ink-quiet">
              You&apos;ll see Facebook&apos;s own consent screen next. Here is
              every permission we request, in plain English.
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
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-7 py-5">
          <ul className="flex flex-col gap-3">
            {PERMISSION_RATIONALES.map((p) => (
              <li
                key={p.scope}
                className="rounded-md border border-rule bg-paper/60 px-3.5 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[14px] font-bold text-ink">{p.label}</div>
                  <code className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                    {p.scope}
                  </code>
                </div>
                <div className="mt-1 text-[13px] leading-[1.45] text-ink-soft">
                  {p.rationale}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[12px] leading-[1.5] text-ink-quiet">
            You can revoke Webnua&apos;s access at any time from your{' '}
            <a
              href="https://www.facebook.com/settings?tab=business_tools"
              target="_blank"
              rel="noreferrer noopener"
              className="text-rust hover:underline"
            >
              Facebook settings
            </a>{' '}
            or from this page using <strong>Disconnect &amp; delete data</strong>.
          </p>
        </div>

        {/* Sticky footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-paper-2 bg-paper px-7 py-3.5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <FacebookConnectButton onClick={onContinue} disabled={busy} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
