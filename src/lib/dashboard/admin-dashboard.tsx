import type { ReactNode } from 'react';

import type { ClientStatus } from '@/components/admin/ClientListRow';

export type ClientRecord = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  status: ClientStatus;
  leadsPerWeek: number;
  spend: string;
  href: string;
};

export const clientsPageHeader: {
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
} = {
  eyebrow: '// Webnua Perth · 4 clients',
  title: (
    <>
      Your <em>clients</em>.
    </>
  ),
  subtitle: (
    <>
      Welcome back, Craig. <strong>One client mid-setup</strong> — Voltline is
      ready for the next step. The other three are live and shipping leads.
    </>
  ),
};

export const allClients: ClientRecord[] = [
  {
    id: 'voltline',
    initial: 'V',
    name: 'Voltline',
    meta: 'Electrical · Perth metro · In setup · Step 1/6',
    status: 'setup',
    leadsPerWeek: 0,
    spend: '—',
    href: '#',
  },
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
