import type { ReactNode } from 'react';

import type { ClientStatus } from '@/components/admin/ClientListRow';

export type DashboardStat = {
  label: string;
  value: ReactNode;
  trend?: string;
  trendTone?: 'good' | 'quiet';
};

export type MidSetupClient = {
  id: string;
  tag: string;
  businessName: string;
  description: string;
  stepLabel: string;
  ownerName: string;
  ownerPhone: string;
  website: string;
  continueHref: string;
};

export type LiveClient = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  status: ClientStatus;
  leadsPerWeek: number;
  spend: string;
  href: string;
};

export const dashboardGreeting = {
  eyebrow: '// Webnua Perth · 4 clients',
  subtitle:
    'Welcome back, Craig. **One client mid-setup** — Voltline is ready for the next step. The other three are live and shipping leads.',
};

export const dashboardStats: DashboardStat[] = [
  {
    label: '// Live clients',
    value: '3',
    trend: '+ 1 in setup',
    trendTone: 'quiet',
  },
  {
    label: '// Leads this week',
    value: <em>34</em>,
    trend: '↑ 8 vs last wk',
    trendTone: 'good',
  },
  {
    label: '// Booked',
    value: '21',
    trend: '62% conv',
    trendTone: 'good',
  },
  {
    label: '// Ad spend',
    value: '$840',
    trend: 'across 3 clients',
    trendTone: 'quiet',
  },
];

export const midSetupClient: MidSetupClient = {
  id: 'voltline',
  tag: '// Mid-setup · Started 14 min ago',
  businessName: 'Voltline',
  description:
    "Electrical · 90-minute response funnel. You've added the business basics — next up: the big idea reframe.",
  stepLabel: 'Step 1/6 done',
  ownerName: 'Mark Cassidy',
  ownerPhone: '0411 567 234',
  website: 'voltline.com.au',
  continueHref: '#',
};

export const liveClients: LiveClient[] = [
  {
    id: 'freshhome',
    initial: 'F',
    name: 'FreshHome Cleaning',
    meta: 'Cleaning · Perth metro · Live 31 days',
    status: 'live',
    leadsPerWeek: 12,
    spend: '$240',
    href: '#',
  },
  {
    id: 'keyhero',
    initial: 'K',
    name: 'KeyHero Locksmith',
    meta: 'Locksmith · Perth metro · Live 12 days',
    status: 'live',
    leadsPerWeek: 8,
    spend: '$315',
    href: '#',
  },
  {
    id: 'neatworks',
    initial: 'N',
    name: 'NeatWorks',
    meta: 'Cleaning · Dublin · Live 6 weeks',
    status: 'live',
    leadsPerWeek: 14,
    spend: '$285',
    href: '#',
  },
];
