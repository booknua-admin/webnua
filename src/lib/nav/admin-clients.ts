export type AdminClient = {
  id: string;
  initial: string;
  name: string;
  meta: string;
  badge?: { text: string; tone?: 'default' | 'muted' };
  status?: 'active' | 'setup';
};

// The seat limit is no longer carried here — it is the `defaultSeatLimit`
// policy key (Cluster 8 · Session 4b). The former per-client seed values
// migrated into SUB_ACCOUNT_OVERRIDE_SEED in lib/agency/override-stub.ts.
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
