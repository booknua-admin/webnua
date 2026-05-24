// =============================================================================
// Client-role sidebar — nav config only.
//
// Identity (workspace name, user name, support contact) is resolved at render
// time in ClientSidebar from the signed-in user + the clients-store, NOT from
// constants here. The audit (reference/onboarding-flow-audit.md §3b) flagged
// the previous hardcoded "Voltline / Mark Cassidy" constants as the single
// most damaging confidence-breaking moment in the product — a paying tradie
// seeing someone else's business name in their own dashboard.
//
// The badge counts in `clientNav` ("5"/"2"/"+2") are presentational
// placeholders pending the unread-count wiring (separate session — flagged in
// the audit's "honourable mentions"). Drop or recompute as those land.
// =============================================================================

import type { NavSection } from './types';

export const clientNav: NavSection[] = [
  {
    label: 'Your business',
    items: [
      { label: 'Home', href: '/dashboard', icon: '⌂' },
      { label: 'Leads', href: '/leads', icon: '✉' },
      { label: 'Tickets', href: '/tickets', icon: '◉' },
      { label: 'Calendar', href: '/calendar', icon: '▤' },
      { label: 'Automations', href: '/automations', icon: '⤿' },
      { label: 'Reviews', href: '/reviews', icon: '★' },
      { label: 'Campaigns', href: '/campaigns', icon: '↗' },
      { label: 'Funnels', href: '/funnels', icon: '⇶' },
      { label: 'Website', href: '/website', icon: '▦' },
      { label: 'Settings', href: '/settings', icon: '⚙' },
    ],
  },
];

/** Support contact — static across all clients today (the managed-service
 *  framing). When white-label / multi-operator deploys land, resolve per
 *  workspace. See the parked decision in CLAUDE.md. */
export const clientSupportContact = {
  label: 'Managed by',
  org: 'Webnua',
  description:
    'Your operator manages your ads, automations and reviews. Open a ticket anytime.',
  ctaLabel: '+ New ticket',
  ctaHref: '/tickets/new',
};
