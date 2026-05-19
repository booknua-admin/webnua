'use client';

// =============================================================================
// IntegrationOnboarding — the surface a brand-new client lands on instead of
// the dashboard. Shown (dispatched from /dashboard) while the client's
// `lifecycle_status` is still `onboarding`.
//
// A new client has no leads / bookings / reviews / funnels yet — a dashboard
// of zeros is noise. Instead they get a guided "connect your accounts" flow.
// The connect actions open the stub ConnectIntegrationModal (real OAuth is
// Phase 7, owned by the human developer). An operator viewing the same
// sub-account gets an extra "mark this client active" control — flipping
// `lifecycle_status` is operator-only (RLS), so it's the onboarding exit.
// =============================================================================

import { useState } from 'react';

import {
  IntegrationCard,
  type IntegrationCardProps,
} from '@/components/shared/settings/IntegrationCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { activateClient } from '@/lib/clients/clients-store';

type IntegrationOnboardingProps = {
  clientName: string;
  clientSlug: string;
  isOperator: boolean;
};

const ONBOARDING_INTEGRATIONS: IntegrationCardProps[] = [
  {
    name: 'Google Business Profile',
    description:
      'Lets Webnua respond to reviews, publish posts, and keep your business hours and details current. Essential for review management.',
    status: 'missing',
    logo: { initial: 'G', tone: 'gbp' },
    action: { label: 'Connect', kind: 'connect' },
  },
  {
    name: 'Meta · Facebook + Instagram',
    description:
      'Required to run your funnel ads, and lets Webnua handle Facebook + Instagram messages alongside your other leads.',
    status: 'missing',
    logo: { initial: 'f', tone: 'meta' },
    action: { label: 'Connect', kind: 'connect' },
  },
  {
    name: 'Google Analytics 4',
    description:
      'Tracks your website and funnel visitors — where they come from, and where they drop off. Powers the performance insights.',
    status: 'missing',
    logo: { initial: 'A', tone: 'ga' },
    action: { label: 'Connect', kind: 'connect' },
  },
  {
    name: 'Google Ads',
    description:
      'Optional — connect this if you want Webnua to run Google Search ads alongside your Meta funnel.',
    status: 'missing',
    logo: { initial: '▲', tone: 'gads' },
    action: { label: 'Connect', kind: 'connect' },
  },
  {
    name: 'Stripe',
    description:
      'Required if your booking funnel takes card payments up front. Without it, customers pay on the day.',
    status: 'missing',
    logo: { initial: 'S', tone: 'stripe' },
    action: { label: 'Connect', kind: 'connect' },
  },
];

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
              Connect your business accounts so Webnua can manage reviews, ads,
              analytics and payments for you.{' '}
              <strong>
                The more you connect, the less your operator has to ask you for
                later.
              </strong>
            </>
          }
        />

        <div className="flex flex-col gap-3">
          {ONBOARDING_INTEGRATIONS.map((integration) => (
            <IntegrationCard key={integration.name} {...integration} />
          ))}
        </div>

        {isOperator ? (
          <OperatorActivatePanel
            clientName={clientName}
            clientSlug={clientSlug}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-rule bg-paper-2 px-6 py-5 text-[13.5px] leading-[1.55] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            Once your accounts are connected, your operator activates your
            workspace — then your dashboard, leads inbox and funnels light up
            with live data. <strong>Need a hand? Open a ticket anytime.</strong>
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
