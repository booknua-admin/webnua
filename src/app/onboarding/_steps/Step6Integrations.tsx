'use client';

// =============================================================================
// Step 6: Connect integrations. All individually skippable.
//
// Three connect cards: Meta Ads, Google Business Profile, custom domain.
// Meta + GBP route through the per-tenant OAuth flow already in use on
// /settings/integrations (the `IntegrationConnectionsSection`) — when the
// customer returns from the OAuth callback the picker auto-opens and the
// status moves to 'connected' the moment they pick.
//
// Custom domain shows the "available after publishing" framing — the
// /settings/domains attach UI works pre-publish but DNS / SSL provisioning
// matters more once they're live. We just capture intent here; the actual
// attach happens post-publish from the dashboard's domain card.
//
// Skip-all is the conservative default — the customer can connect every
// integration from /settings/integrations any time later.
// =============================================================================

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { IntegrationConnectionsSection } from '@/components/shared/settings/IntegrationConnectionsSection';
import type { Step6Data } from '@/lib/onboarding/types';

import { StepFrame } from './_step-frame';

type Step6Props = {
  initial: Step6Data | null;
  clientSlug: string;
  clientName: string;
  onContinue: (data: Step6Data) => void;
  onSkip: () => void;
  onBack: () => void;
};

export function Step6Integrations({
  initial,
  clientSlug,
  clientName,
  onContinue,
  onSkip,
  onBack,
}: Step6Props) {
  // Status is purely UI cue — the IntegrationConnectionsSection drives the
  // real state via its own RLS-scoped reads. We capture what the customer
  // "intends" so the step 7 summary can show "you connected 2 of 3".
  const [metaAds, setMetaAds] = useState(initial?.metaAds ?? 'pending');
  const [gbp, setGbp] = useState(initial?.gbp ?? 'pending');
  const [customDomain, setCustomDomain] = useState(initial?.customDomainPlanned ?? false);

  function handleContinue() {
    onContinue({
      metaAds,
      gbp,
      customDomainPlanned: customDomain,
    });
  }

  return (
    <StepFrame
      title={
        <>
          Connect your <em>business accounts</em>.
        </>
      }
      description={
        <>
          These let Webnua run reviews + ads on your behalf. <strong>Skip any
          you don&rsquo;t use today</strong> — you can connect them later from
          Settings.
        </>
      }
      onContinue={handleContinue}
      onSkip={onSkip}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        {/* The real connect surface — same component the
            sub-account /settings/integrations + the dashboard wizard
            use. Callback returnTo points back to /onboarding so the
            customer lands here after OAuth. */}
        <IntegrationConnectionsSection
          clientSlug={clientSlug}
          clientName={clientName}
          returnTo="/onboarding"
        />

        {/* Per-integration UI hints. The OAuth surface above is the
            source of truth; these capture the customer's stated intent
            so step 7's summary can read it back. */}
        <IntentRow
          label="Meta Ads (Facebook + Instagram)"
          description="So Webnua can run lead campaigns on your behalf."
          value={metaAds}
          onChange={setMetaAds}
        />
        <IntentRow
          label="Google Business Profile"
          description="So new Google reviews land in your dashboard + we can ask happy customers to leave them."
          value={gbp}
          onChange={setGbp}
        />

        {/* Custom-domain row — a checkbox + a "later" framing. */}
        <div className="rounded-xl border border-rule bg-card px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold text-ink">
                Use my own domain (e.g. <span className="font-mono">{clientName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com</span>)
              </div>
              <p className="mt-0.5 text-[12.5px] leading-[1.4] text-ink-quiet">
                Available after you publish. We&rsquo;ll guide you through the
                DNS records when you&rsquo;re ready.
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2">
              <input
                type="checkbox"
                checked={customDomain}
                onChange={(e) => setCustomDomain(e.target.checked)}
                className="h-5 w-5 cursor-pointer rounded border-rule"
              />
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">
                I want to use my own domain
              </span>
            </label>
          </div>
        </div>
      </div>
    </StepFrame>
  );
}

function IntentRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: 'pending' | 'connected' | 'skipped';
  onChange: (next: 'pending' | 'connected' | 'skipped') => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-rule bg-paper-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[13.5px] font-extrabold text-ink">{label}</div>
        <p className="mt-0.5 text-[12px] leading-[1.4] text-ink-quiet">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <PillButton active={value === 'connected'} onClick={() => onChange('connected')}>
          Connected
        </PillButton>
        <PillButton active={value === 'skipped'} onClick={() => onChange('skipped')}>
          Skip for now
        </PillButton>
      </div>
    </div>
  );
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ' +
        (active
          ? 'border-rust bg-rust text-paper'
          : 'border-rule bg-card text-ink-soft hover:border-ink')
      }
    >
      {children}
    </button>
  );
}

// Suppress unused-import lint while we expose Button for future use.
void Button;
