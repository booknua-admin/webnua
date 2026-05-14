import type { NavSection } from './types';

export const adminOverviewNav: NavSection = {
  label: 'Overview',
  items: [{ label: 'Dashboard', href: '/clients', icon: '⊞' }],
};

export const adminWorkspaceNav: NavSection = {
  label: 'Workspace',
  items: [
    {
      label: 'Webnua leads',
      href: '/webnua-leads',
      icon: '✉',
      badge: { text: '23' },
    },
    { label: 'Tickets', href: '/tickets', icon: '◉', badge: { text: '7' } },
    { label: 'Websites', href: '/websites', icon: '▦' },
    { label: 'Internal automations', href: '/automations', icon: '⤿' },
    { label: 'Campaigns', href: '/campaigns', icon: '↗' },
    { label: 'Reviews', href: '/reviews', icon: '★' },
    {
      label: 'Integrations',
      href: '/integrations',
      icon: '⚭',
      badge: { text: '1' },
    },
    { label: 'Calendar', href: '/calendar', icon: '▤' },
    { label: 'Settings', href: '/settings', icon: '⚙' },
  ],
};

export const adminWorkspace = {
  label: 'Workspace',
  name: 'Webnua',
};

export const adminUser = {
  initial: 'C',
  name: 'Craig F.',
  role: 'Operator',
};
