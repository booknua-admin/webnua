import type { SettingsNavItem } from './types';

// The operator's agency-mode settings nav. The full agency-tier surface set
// is broader than what's wired today — V1 hides agency-as-a-business surfaces
// that don't ship until the actual agency plan launches (so an Owner-only
// operator isn't looking at dead-ends in their sidebar).
//
// Hidden until the agency plan ships:
//   - /settings/api  (operator-facing API keys + webhook console — deferred
//     per CLAUDE.md "API & services" entry; the routes still exist for the
//     dev who knows the URL)
//   - /settings/seats  (agency-wide default seat limit — only meaningful when
//     more than one operator workspace exists)
//
// Kept but with honest "coming soon" content where the wiring isn't real:
//   - /settings/billing  (agency-mode shows fake invoices; routed to a
//     placeholder card until billing-as-a-product is built)
//   - /settings/integrations  (agency-mode matrix shows fake client rows;
//     hidden behind a placeholder until the cross-client query lands)
export const adminSettingsNav: SettingsNavItem[] = [
  { label: 'Workspace', href: '/settings/workspace', icon: '⊕' },
  { label: 'Team', href: '/settings/team', icon: '⌥' },
  { label: 'Access', href: '/settings/access', icon: '⌗' },
  { label: 'Integrations', href: '/settings/integrations', icon: '⊠' },
  { label: 'Domains', href: '/settings/domains', icon: '◉' },
  { label: 'Billing', href: '/settings/billing', icon: '$' },
  { label: 'Plans', href: '/settings/plans', icon: '◈' },
  { label: 'Defaults', href: '/settings/defaults', icon: '⚐' },
  { label: 'Platform templates', href: '/settings/platform-templates', icon: '✉' },
  { label: 'Danger zone', href: '/settings/danger', icon: '⤬' },
];
