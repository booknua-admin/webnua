import type {
  IntegrationLogoTone,
  IntegrationStatus,
} from '@/components/shared/settings/IntegrationCard';

type ClientIntegration = {
  id: string;
  name: string;
  description: React.ReactNode;
  status: IntegrationStatus;
  statusLabel?: string;
  logo: { initial: string; tone: IntegrationLogoTone };
  meta?: React.ReactNode;
  action: { label: string; href?: string };
};

export const clientIntegrationsHero = {
  tag: '3 of 5 connected',
  title: (
    <>
      Connect your <em>business accounts</em>
    </>
  ),
  subtitle: (
    <>
      Each integration lets Webnua handle something specific on your behalf — respond to reviews,
      run ads, take payments.{' '}
      <strong>The more you connect, the less Craig has to ask you for later.</strong>
    </>
  ),
  connected: 3,
  total: 5,
  remaining: (
    <>
      <strong>2 left to connect</strong>
      <br />
      Stripe + Google Ads
    </>
  ),
};

export const clientIntegrations: ClientIntegration[] = [
  {
    id: 'gbp',
    name: 'Google Business Profile',
    description: (
      <>
        Lets Webnua respond to reviews, publish posts, and update your business hours.{' '}
        <strong>Essential for review management.</strong>
      </>
    ),
    status: 'connected',
    logo: { initial: 'G', tone: 'gbp' },
    meta: (
      <>
        Connected as <strong>info@voltline.com.au</strong> · synced 2m ago
      </>
    ),
    action: { label: 'Manage' },
  },
  {
    id: 'meta',
    name: 'Meta · Facebook + Instagram',
    description:
      'Required for the $99 emergency funnel ads to run. Also lets Craig respond to Facebook + Instagram messages from your inbox.',
    status: 'connected',
    logo: { initial: 'f', tone: 'meta' },
    meta: (
      <>
        Connected as <strong>Voltline Perth</strong> · 2 pages · synced 8m ago
      </>
    ),
    action: { label: 'Manage' },
  },
  {
    id: 'ga',
    name: 'Google Analytics 4',
    description: (
      <>
        Tracks your website visitors and where they come from.{' '}
        <strong>Token expired 2 days ago</strong> — Webnua isn&apos;t getting fresh data until you
        reconnect.
      </>
    ),
    status: 'warning',
    logo: { initial: 'A', tone: 'ga' },
    meta: (
      <>
        Last sync <strong>2 days ago</strong> · token expired
      </>
    ),
    action: { label: 'Reauthorize' },
  },
  {
    id: 'gads',
    name: 'Google Ads',
    description:
      'Required if you want Webnua to run Google Search ads alongside your Meta funnel — for capturing "emergency electrician Perth" searches.',
    status: 'missing',
    logo: { initial: '▲', tone: 'gads' },
    meta: <>Optional · only if running Google ads</>,
    action: { label: 'Connect' },
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: (
      <>
        <strong>Required for $99 emergency call-out funnel payments.</strong> Without Stripe, the
        booking funnel can&apos;t take card payments — leads have to pay on the day.
      </>
    ),
    status: 'missing',
    logo: { initial: 'S', tone: 'stripe' },
    meta: <>⚠ Required for the funnel · 2 min setup</>,
    action: { label: 'Connect' },
  },
];
