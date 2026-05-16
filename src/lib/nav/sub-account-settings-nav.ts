import type { SettingsNavItem } from './types';

// The operator's sub-account-mode settings nav — drilled into one client via
// the sidebar picker. Distinct from `adminSettingsNav` (agency HQ) and
// `clientSettingsNav` (the client's own view of their account). Access
// appears here AND in the agency nav — it is the one genuinely bi-modal
// surface (agency birds-eye vs the drilled-in cap grid).
export const subAccountSettingsNav: SettingsNavItem[] = [
  { label: 'Profile', href: '/settings/profile', icon: '⊕' },
  { label: 'Access', href: '/settings/access', icon: '⌗' },
  { label: 'Team', href: '/settings/team', icon: '⌥' },
  { label: 'Integrations', href: '/settings/integrations', icon: '⊠' },
  { label: 'Notifications', href: '/settings/notifications', icon: '🔔' },
  { label: 'Billing', href: '/settings/billing', icon: '$' },
  { label: 'Danger zone', href: '/settings/danger', icon: '⤬' },
];
