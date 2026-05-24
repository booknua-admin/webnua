'use client';

// =============================================================================
// IntegrationOnboarding — the post-sign-in onboarding flow.
//
// A brand-new client (lifecycle_status = 'onboarding') lands here instead of
// the dashboard. Their inbox is empty; a dashboard of zeros is noise. The
// screen guides them through the three setup decisions that actually unlock
// the platform:
//
//   1. Billing — start the Stripe subscription so the workspace is active.
//   2. Connect their business accounts (Google Business Profile, Meta Ads) —
//      the per-tenant OAuth flows. Each Connect button triggers the SAME
//      real OAuth flow used on /settings/integrations; on return, the
//      post-OAuth picker auto-opens (location picker / ad-account picker)
//      via `IntegrationCallbackPickers`, which is mounted inside
//      `IntegrationConnectionsSection`. The OAuth callback `returnTo` is
//      set to `/dashboard` so the user lands back here rather than on
//      `/settings/integrations`.
//   3. Their own domain (optional, link to `/settings/domains`).
//
// AUDIT REMEDIATION. The audit (reference/onboarding-flow-audit.md §3 Step 4)
// flagged the previous screen — five `IntegrationCard` stubs that opened the
// fake `ConnectIntegrationModal` — as Critical: a client clicking Connect saw
// a fake 4-step modal that closed without doing anything, with the workspace
// then blocked behind operator activation. The new surface uses the real
// Phase 7 OAuth + Stripe flows. The Connect buttons are wired; clicks now
// produce real DB writes and integration state.
//
// An operator drilled into the sub-account sees the same surface, plus a
// "Mark client active" button (the workspace's onboarding exit; gated by RLS
// to the `admin` role).
// =============================================================================

import Link from 'next/link';
import { useState } from 'react';

import { PageHeader } from '@/components/shared/PageHeader';
import { IntegrationConnectionsSection } from '@/components/shared/settings/IntegrationConnectionsSection';
import { SettingsPanel } from '@/components/shared/settings/SettingsPanel';
import { SettingsSection } from '@/components/shared/settings/SettingsSection';
import { StripeSubscriptionSection } from '@/components/shared/settings/StripeSubscriptionSection';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { activateClient } from '@/lib/clients/clients-store';

type IntegrationOnboardingProps = {
  clientName: string;
  clientSlug: string;
  isOperator: boolean;
};

function IntegrationOnboarding({
  clientName,
  clientSlug,
  isOperator,
}: IntegrationOnboardingProps) {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Get started" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          className="mb-0"
          eyebrow="// Welcome to Webnua"
          title={
            <>
              Let&rsquo;s get {clientName} <em>set up</em>.
            </>
          }
          subtitle={
            <>
              Three steps unlock the platform: start your subscription, connect your business
              accounts so Webnua can run reviews + ads on your behalf, and (optional) point your
              own domain at your new site.{' '}
              <strong>Each Connect button below opens the real provider — no stubs.</strong>
            </>
          }
        />

        {/* 1 — Stripe subscription. The Stripe checkout + portal routes were
            widened to `requireClientAccess` in this session — the client
            subscribes themselves; the operator can also do it from here. */}
        <SettingsPanel>
          <StripeSubscriptionSection clientSlug={clientSlug} clientName={clientName} />
        </SettingsPanel>

        {/* 2 — Per-tenant OAuth (GBP + Meta Ads). The same component the
            sub-account /settings/integrations view uses — same real OAuth
            calls, same post-OAuth picker auto-open. `returnTo` lands the
            callback back on /dashboard so the pickers open here, not on
            /settings/integrations. */}
        <IntegrationConnectionsSection
          clientSlug={clientSlug}
          clientName={clientName}
          returnTo="/dashboard"
        />

        {/* 3 — Optional custom domain. The real attach flow lives on
            /settings/domains (Phase 9). We surface it as a link rather than
            inline so the onboarding screen stays focused on the critical
            path — most clients can skip this and use {slug}.webnua.dev. */}
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Your own <em>domain</em> (optional)
              </>
            }
            description={
              <>
                Point a domain you already own (e.g. <strong>{clientName.toLowerCase()}.com</strong>)
                at your Webnua site. You can do this now or later — your{' '}
                <strong>{clientSlug}.webnua.dev</strong> address works either way.
              </>
            }
          >
            <div className="flex items-center justify-between gap-4 rounded-[10px] border border-dashed border-rule bg-paper px-5 py-[18px]">
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-ink">
                  Attach a custom domain
                </div>
                <p className="mt-1 text-[13px] leading-[1.5] text-ink-quiet">
                  We&apos;ll show you the exact DNS records to add at your registrar and
                  watch the verification + SSL until your site goes live on it.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/domains">Add domain →</Link>
              </Button>
            </div>
          </SettingsSection>
        </SettingsPanel>

        {isOperator ? (
          <OperatorActivatePanel
            clientName={clientName}
            clientSlug={clientSlug}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-rule bg-paper-2 px-6 py-5 text-[13.5px] leading-[1.55] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            Once your subscription is live and your accounts are connected, your operator
            switches your workspace into live mode — your dashboard, leads inbox and funnels
            light up with real data. <strong>Need a hand? Open a ticket anytime.</strong>
          </p>
        )}
      </div>
    </>
  );
}

function OperatorActivatePanel({
  clientName,
  clientSlug,
}: {
  clientName: string;
  clientSlug: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = () => {
    if (pending) return;
    setPending(true);
    setError(null);
    void activateClient(clientSlug).then((result) => {
      // On success the clients cache re-hydrates → /dashboard re-renders out
      // of onboarding into the hub. On failure surface the message.
      if (!result.ok) {
        setError(result.message);
        setPending(false);
      }
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-rule bg-card px-6 py-5">
      <div>
        <div className="text-[15px] font-extrabold tracking-[-0.02em] text-ink">
          Finished onboarding {clientName}?
        </div>
        <p className="mt-1 text-[13px] leading-[1.5] text-ink-quiet">
          Mark the client active to take them out of onboarding — their
          dashboard and surfaces switch to the live workspace view.
        </p>
        {error ? (
          <p className="mt-1.5 text-[13px] font-semibold text-warn">{error}</p>
        ) : null}
      </div>
      <Button onClick={activate} disabled={pending}>
        {pending ? 'Activating…' : 'Mark client active →'}
      </Button>
    </div>
  );
}

export { IntegrationOnboarding };
