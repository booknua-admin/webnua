export type AdminClient = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  badge?: { text: string; tone?: 'default' | 'muted' };
  status?: 'active' | 'setup';
  /** Max users the client's plan permits. null = unconfigured (uncapped).
   *  Seed value — operator overrides live in lib/clients/seat-limit-stub.ts. */
  seatLimit: number | null;
};

export const adminClients: AdminClient[] = [
  {
    id: 'voltline',
    initial: 'V',
    name: 'Voltline',
    meta: 'Electrical · in setup',
    badge: { text: 'Setup', tone: 'muted' },
    status: 'setup',
    seatLimit: 3,
  },
  {
    id: 'freshhome',
    initial: 'F',
    name: 'FreshHome',
    meta: 'Cleaning · 12 new leads',
    badge: { text: '12' },
    seatLimit: 5,
  },
  {
    id: 'keyhero',
    initial: 'K',
    name: 'KeyHero',
    meta: 'Locksmith · 3 new leads',
    badge: { text: '3' },
    seatLimit: null,
  },
  {
    id: 'neatworks',
    initial: 'N',
    name: 'NeatWorks',
    meta: 'Cleaning · Dublin',
    seatLimit: null,
  },
];
