import type { SettingsNavItem } from './types';

// The operator's agency-mode settings nav. Workspace / Team / Access /
// Integrations / Billing / Defaults are existing surfaces; Default seat limit
// (Cluster 8 · Session 3) and Plans (Cluster 9 · Session 2) are the
// agency-policy surfaces that consume lib/agency/ (the policy resolver) and
// lib/billing/ (the plan catalog). "API & services" holds the platform
// plumbing (Stripe / Resend / Twilio / …) + API keys + webhooks; the agency
// connection policy folds into the Integrations tab (agency mode).
export const adminSettingsNav: SettingsNavItem[] = [
  { label: 'Workspace', href: '/settings/workspace', icon: '⊕' },
  { label: 'Team', href: '/settings/team', icon: '⌥' },
  { label: 'Access', href: '/settings/access', icon: '⌗' },
  { label: 'Integrations', href: '/settings/integrations', icon: '⊠' },
  { label: 'Domains', href: '/settings/domains', icon: '◉' },
  { label: 'Billing', href: '/settings/billing', icon: '$' },
  { label: 'Plans', href: '/settings/plans', icon: '◈' },
  { label: 'Defaults', href: '/settings/defaults', icon: '⚐' },
  { label: 'Default seat limit', href: '/settings/seats', icon: '⊜' },
  { label: 'API & services', href: '/settings/api', icon: '⚿' },
  { label: 'Platform templates', href: '/settings/platform-templates', icon: '✉' },
  { label: 'Danger zone', href: '/settings/danger', icon: '⤬' },
];
