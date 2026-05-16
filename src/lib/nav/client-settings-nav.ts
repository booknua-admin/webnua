import type { SettingsNavItem } from './types';

export const clientSettingsNav: SettingsNavItem[] = [
  { label: 'Integrations', href: '/settings/integrations', icon: '⚭' },
  { label: 'Profile', href: '/settings/profile', icon: '⊕' },
  { label: 'Team', href: '/settings/team', icon: '⌥' },
  { label: 'Notifications', href: '/settings/notifications', icon: '🔔' },
  { label: 'Billing', href: '/settings/billing', icon: '$' },
  { label: 'Login + security', href: '/settings/security', icon: '⌨' },
  { label: 'Help', href: '/settings/help', icon: '?' },
];
