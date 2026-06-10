import type { NavSection } from './types';

export const adminWorkspaceNav: NavSection = {
  label: 'Workspace',
  items: [
    { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
    { label: 'Signups', href: '/signups', icon: '☞' },
    // Leads + Tickets badges are injected live in AdminSidebar via
    // `useAdminNavBadgeCounts()`. Do NOT add hardcoded `badge:` here —
    // they would render and then be overwritten on hydrate.
    { label: 'Leads', href: '/leads', icon: '✉' },
    { label: 'Tickets', href: '/tickets', icon: '◉' },
    { label: 'Websites', href: '/websites', icon: '▦' },
    { label: 'Funnels', href: '/funnels', icon: '⇶' },
    { label: 'Internal automations', href: '/automations', icon: '⤿' },
    { label: 'Campaigns', href: '/campaigns', icon: '↗' },
    { label: 'Social', href: '/social', icon: '✦' },
    { label: 'Reviews', href: '/reviews', icon: '★' },
    { label: 'Calendar', href: '/calendar', icon: '▤' },
    { label: 'Settings', href: '/settings', icon: '⚙' },
  ],
};

export const adminWorkspace = {
  label: 'Workspace',
  name: 'Webnua',
};

// Operator identity (user name / initial / role label) is resolved live from
// the signed-in user inside AdminSidebar — never via a constant. The previous
// hardcoded `adminUser` constant was dropped with the sidebar identity fix.
