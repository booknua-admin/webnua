import type { NavSection } from './types';

export const clientNav: NavSection[] = [
  {
    label: 'Your business',
    items: [
      { label: 'Home', href: '/dashboard', icon: '⌂' },
      { label: 'Leads', href: '/leads', icon: '✉', badge: { text: '5' } },
      { label: 'Tickets', href: '/tickets', icon: '◉', badge: { text: '2' } },
      { label: 'Calendar', href: '/calendar', icon: '▤' },
      { label: 'Automations', href: '/automations', icon: '⤿' },
      {
        label: 'Reviews',
        href: '/reviews',
        icon: '★',
        badge: { text: '+2', tone: 'muted' },
      },
      { label: 'Campaigns', href: '/campaigns', icon: '↗' },
      { label: 'Funnels', href: '/funnels', icon: '⇶' },
      { label: 'Website', href: '/website', icon: '▦' },
      { label: 'Settings', href: '/settings', icon: '⚙' },
    ],
  },
];

export const clientWorkspace = {
  initial: 'V',
  name: 'Voltline',
  status: 'Live · day 14',
};

export const clientSupport = {
  label: 'Managed by',
  org: 'Webnua',
  description:
    'Your operator manages your ads, automations and reviews. Ping us anytime.',
  ctaLabel: '☏ Message us',
  ctaHref: '/support',
};

export const clientUser = {
  initial: 'M',
  name: 'Mark Cassidy',
  role: 'Voltline · Owner',
};
