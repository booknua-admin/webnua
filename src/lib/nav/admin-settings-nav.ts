import type { SettingsNavItem } from './types';

// The operator's agency-mode settings nav. Workspace / Team / Access /
// Integrations / Billing / Defaults are existing surfaces; Integration
// defaults + Default seat limit (Cluster 8 · Session 3) are the net-new
// agency-policy surfaces that consume lib/agency/ (the policy resolver).
export const adminSettingsNav: SettingsNavItem[] = [
  { label: 'Workspace', href: '/settings/workspace', icon: '⊕' },
  { label: 'Team', href: '/settings/team', icon: '⌥' },
  { label: 'Access', href: '/settings/access', icon: '⌗' },
  { label: 'Integrations', href: '/settings/integrations', icon: '⊠' },
  { label: 'Billing', href: '/settings/billing', icon: '$' },
  { label: 'Defaults', href: '/settings/defaults', icon: '⚐' },
  { label: 'Integration defaults', href: '/settings/integration-defaults', icon: '⊟' },
  { label: 'Default seat limit', href: '/settings/seats', icon: '⊜' },
  { label: 'API + webhooks', href: '/settings/api', icon: '⚿' },
  { label: 'Danger zone', href: '/settings/danger', icon: '⤬' },
];
