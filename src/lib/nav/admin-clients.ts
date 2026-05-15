export type AdminClient = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  badge?: { text: string; tone?: 'default' | 'muted' };
  status?: 'active' | 'setup';
};

export const adminClients: AdminClient[] = [
  {
    id: 'voltline',
    initial: 'V',
    name: 'Voltline',
    meta: 'Electrical · in setup',
    badge: { text: 'Setup', tone: 'muted' },
    status: 'setup',
  },
  {
    id: 'freshhome',
    initial: 'F',
    name: 'FreshHome',
    meta: 'Cleaning · 12 new leads',
    badge: { text: '12' },
  },
  {
    id: 'keyhero',
    initial: 'K',
    name: 'KeyHero',
    meta: 'Locksmith · 3 new leads',
    badge: { text: '3' },
  },
  {
    id: 'neatworks',
    initial: 'N',
    name: 'NeatWorks',
    meta: 'Cleaning · Dublin',
  },
];
