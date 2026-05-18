import type {
  IntegrationAction,
  IntegrationLogoTone,
  IntegrationStatus,
} from '@/components/shared/settings/IntegrationCard';

// Platform plumbing — the agency's own service credentials that power the
// product (payments, email, SMS, AI copy, hosting). Distinct from business
// integrations (GBP / Meta / GA4 / …) which each client connects at the
// sub-account level. Surfaced on /settings/api ("API & services"), not on
// /settings/integrations.

type PlatformService = {
  id: string;
  name: string;
  description: React.ReactNode;
  status: IntegrationStatus;
  statusLabel?: string;
  logo: { initial: string; tone?: IntegrationLogoTone };
  meta?: React.ReactNode;
  action: IntegrationAction;
};

export const adminPlatformServices: PlatformService[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: (
      <>
        Payment processing · <strong>handles funnel card payments</strong> across every client
        funnel · 1.75% + 30c per transaction (AU)
      </>
    ),
    status: 'connected',
    logo: { initial: 'S', tone: 'stripe' },
    action: { label: 'Manage →', kind: 'manage' },
  },
  {
    id: 'resend',
    name: 'Resend',
    description: (
      <>
        Transactional email · <strong>2,840 sent / 10,000 monthly limit</strong> · 96% delivery
      </>
    ),
    status: 'connected',
    logo: { initial: 'R' },
    action: { label: 'Manage →', kind: 'manage' },
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: (
      <>
        SMS · <strong>1,284 sent this month</strong> · Perth + Dublin numbers · $0.04 / msg avg
      </>
    ),
    status: 'connected',
    logo: { initial: 'T' },
    action: { label: 'Manage →', kind: 'manage' },
  },
  {
    id: 'anthropic',
    name: 'Anthropic API',
    description: (
      <>
        AI copy generation · <strong>$12 this month</strong> · Sonnet 4 + Haiku 4.5 mix
      </>
    ),
    status: 'connected',
    logo: { initial: 'A' },
    action: { label: 'Manage →', kind: 'manage' },
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: (
      <>
        Landing page hosting · <strong>4 deployments</strong> · 16 edge regions · 99.99% uptime
      </>
    ),
    status: 'connected',
    logo: { initial: 'V' },
    action: { label: 'Manage →', kind: 'manage' },
  },
];
