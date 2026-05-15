import type { SettingsNavItem } from './types';

export const adminSettingsNav: SettingsNavItem[] = [
  { label: 'Workspace', href: '/settings/workspace', icon: '⊕' },
  { label: 'Team', href: '/settings/team', icon: '⌥' },
  { label: 'Access', href: '/settings/access', icon: '⌗' },
  { label: 'Integrations', href: '/settings/integrations', icon: '⊠' },
  { label: 'Billing', href: '/settings/billing', icon: '$' },
  { label: 'Defaults', href: '/settings/defaults', icon: '⚐' },
  { label: 'API + webhooks', href: '/settings/api', icon: '⚿' },
  { label: 'Danger zone', href: '/settings/danger', icon: '⤬' },
];
