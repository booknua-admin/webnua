'use client';

// =============================================================================
// IntegrationOnboarding — Pattern B's pre-published workspace surface.
//
// Mounted by /dashboard when the client is in a pre-onboarding lifecycle
// state ('pending_verification' / 'preview' / legacy 'onboarding'). What
// the user sees depends on the EXACT state:
//
//   pending_verification → "Check your email" message. The user must click
//                          the magic link from their verification email to
//                          flip the workspace to 'preview' before the rest
//                          of the surface unlocks.
//   preview              → The wizard surface (Stripe billing, integration
//                          connect cards, custom domain link), plus the
//                          PublishToGoLiveCTA at the TOP — the moment the
//                          customer's site looks good they hit Publish and
//                          pay. This is the conversion surface.
//   onboarding (legacy)  → Treated as 'preview' (Session 1 clients keep
//                          their existing experience but also see Publish).
//
// An operator drilled into the sub-account sees the same surface PLUS the
// manual "Mark client active" panel — for concierge close (operator
// collected payment out-of-band).
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

import { PublishToGoLiveCTA } from './PublishToGoLiveCTA';

type IntegrationOnboardingProps = {
  clientName: string;
  clientSlug: string;
  isOperator: boolean;
  /** The client's raw lifecycle_status. Drives the per-state surface:
   *  pending_verification → "check your email" gate; preview/onboarding →
   *  full wizard + publish CTA. */
  lifecycleStatus: string;
};

function IntegrationOnboarding({
  clientName,
  clientSlug,
  isOperator,
  lifecycleStatus,
}: IntegrationOnboardingProps) {
  // Pending-verification state: the user clicked the magic link OR an
  // operator just created this client; the auth-confirm trigger has not yet
  // run. Show a "check your email" gate rather than a half-functional
  // wizard, so the customer's first impression is clear.
  if (lifecycleStatus === 'pending_verification') {
    return (
      <PendingVerificationSurface
        clientName={clientName}
        isOperator={isOperator}
        clientSlug={clientSlug}
      />
    );
  }

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Get started" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          className="mb-0"
          eyebrow="// Welcome to Webnua"
          title={
            <>
              Let&rsquo;s get {clientName} <em>live</em>.
            </>
          }
          subtitle={
            <>
              Connect your business accounts so Webnua can run reviews + ads on
              your behalf — then hit <strong>Publish to go live</strong> when
              you&rsquo;re ready. Your site is already up at your preview URL.
            </>
          }
        />

        {/* PUBLISH CTA — the conversion moment. Mounted at the top so the
            customer sees it whenever they return to the dashboard. */}
        <PublishToGoLiveCTA clientSlug={clientSlug} clientName={clientName} />

        {/* Per-tenant OAuth (GBP + Meta Ads). Reuses the sub-account
            settings component, with returnTo='/dashboard' so the post-OAuth
            callback lands back here (not on /settings/integrations). */}
        <IntegrationConnectionsSection
          clientSlug={clientSlug}
          clientName={clientName}
          returnTo="/dashboard"
        />

        {/* Stripe billing — visible here too so the customer can pre-fill
            their card if they want to, even before hitting Publish. The
            Publish CTA above is the primary conversion path. */}
        <SettingsPanel>
          <StripeSubscriptionSection clientSlug={clientSlug} clientName={clientName} />
        </SettingsPanel>

        {/* Optional custom domain — defers to /settings/domains. */}
        <SettingsPanel>
          <SettingsSection
            heading={
              <>
                Your own <em>domain</em> (optional)
              </>
            }
            description={
              <>
                Point a domain you already own (e.g.{' '}
                <strong>{clientName.toLowerCase()}.com</strong>) at your Webnua site.
                You can do this now or later — your{' '}
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
                  We&rsquo;ll show you the exact DNS records to add at your
                  registrar and watch the verification + SSL until your site goes
                  live on it.
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
            Want to see what your site looks like first?{' '}
            <strong>Open {clientSlug}.webnua.dev</strong> in a new tab — every
            edit you make in the editor lands there immediately (preview mode,
            so forms stay disabled). Hit Publish above when you&rsquo;re ready
            to go live.
          </p>
        )}
      </div>
    </>
  );
}

/** Pending-verification gate. The user can technically reach the dashboard
 *  if they paste in their magic link (the auth session is set), but the
 *  AFTER UPDATE trigger on auth.users.email_confirmed_at takes a beat to
 *  propagate. If they land here in 'pending_verification' state, show a
 *  short "we're waiting for verification" message rather than a half-built
 *  wizard. An operator drilled in sees the same screen + the manual
 *  activate panel below it. */
function PendingVerificationSurface({
  clientName,
  isOperator,
  clientSlug,
}: {
  clientName: string;
  isOperator: boolean;
  clientSlug: string;
}) {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Verify your email" />} />
      <div className="flex flex-col gap-7 px-10 py-10">
        <PageHeader
          className="mb-0"
          eyebrow="// Almost there"
          title={
            <>
              Confirm your <em>email</em>.
            </>
          }
          subtitle={
            <>
              We&rsquo;ve sent a sign-in link to your inbox.{' '}
              <strong>Click the link to confirm your email</strong> — your
              workspace ({clientName}) unlocks the moment you do.
            </>
          }
        />

        <div className="rounded-xl border border-dashed border-rule bg-paper-2 px-6 py-5 text-[13.5px] leading-[1.55] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
          <strong>Can&rsquo;t find the email?</strong> Check your spam folder. If
          it never arrives, sign out and run the sign-in flow again — Webnua
          will send a fresh link.
        </div>

        {isOperator ? (
          <OperatorActivatePanel
            clientName={clientName}
            clientSlug={clientSlug}
          />
        ) : null}
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
          Concierge close for {clientName}?
        </div>
        <p className="mt-1 text-[13px] leading-[1.5] text-ink-quiet">
          If payment was collected out-of-band (Stripe Invoice, bank
          transfer), mark the client active to take them out of preview —
          their public site goes live + the publish CTA disappears.
        </p>
        {error ? (
          <p className="mt-1.5 text-[13px] font-semibold text-warn">{error}</p>
        ) : null}
      </div>
      <Button onClick={activate} disabled={pending} variant="outline">
        {pending ? 'Activating…' : 'Mark active (concierge) →'}
      </Button>
    </div>
  );
}

export { IntegrationOnboarding };
