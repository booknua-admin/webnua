import type {
  IntegrationLogoTone,
  IntegrationStatus,
} from '@/components/shared/settings/IntegrationCard';

type AdminIntegration = {
  id: string;
  name: string;
  description: React.ReactNode;
  status: IntegrationStatus;
  statusLabel?: string;
  logo: { initial: string; tone?: IntegrationLogoTone };
  meta?: React.ReactNode;
  action: { label: string; href?: string };
};

export const adminConnectedIntegrations: AdminIntegration[] = [
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
    action: { label: 'Manage →' },
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
    action: { label: 'Manage →' },
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    description: (
      <>
        Read-only API · <strong>4 ad accounts connected</strong> · 3 active campaigns
      </>
    ),
    status: 'connected',
    logo: { initial: 'M', tone: 'meta' },
    action: { label: 'Manage →' },
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    description: (
      <>
        <strong>3 of 4 clients connected</strong> · Voltline pending (started 3d ago)
      </>
    ),
    status: 'partial',
    statusLabel: '3 / 4 connected',
    logo: { initial: 'G', tone: 'gbp' },
    action: { label: 'Connect Voltline →' },
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
    action: { label: 'Manage →' },
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
    action: { label: 'Manage →' },
  },
];

export const adminAvailableIntegrations: AdminIntegration[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payment processing for client billing · 1.75% + 30c per transaction (AU)',
    status: 'missing',
    logo: { initial: 'S', tone: 'stripe' },
    action: { label: 'Connect →' },
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Accounting sync · invoice export, BAS reporting',
    status: 'missing',
    logo: { initial: 'X' },
    action: { label: 'Connect →' },
  },
];
