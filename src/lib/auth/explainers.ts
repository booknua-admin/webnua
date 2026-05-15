// =============================================================================
// Per-capability explainer strings. Surfaced by <CapabilityGate> in the
// `disable` mode (as a tooltip) and `request` mode (as the affordance label).
//
// Parked decision (see CLAUDE.md): "your operator" / "your account" assume
// the Webnua managed-service relationship. If multi-operator deploys land
// later, swap to an {operatorLabel} token resolved per workspace.
//
// `requestLabel: ''` opts the cap out of `request` mode — gate falls back
// to `hide` rather than rendering a labelless affordance. Applies to
// viewBuilder + approve (no meaningful request-change message for these).
// =============================================================================

import type { Capability } from './capabilities';

export type CapExplainer = {
  short: string;
  requestLabel: string;
};

export const CAP_EXPLAINER: Record<Capability, CapExplainer> = {
  viewBuilder: {
    short: "You don't have access to the page builder.",
    requestLabel: '',
  },
  editCopy: {
    short: 'Your operator manages copy on this page.',
    requestLabel: 'Request a copy change',
  },
  editMedia: {
    short: 'Your operator manages images on this page.',
    requestLabel: 'Request an image change',
  },
  editSEO: {
    short: 'Your operator manages SEO settings.',
    requestLabel: 'Request an SEO change',
  },
  editLayout: {
    short: 'Layout changes are managed by your operator.',
    requestLabel: 'Request a layout change',
  },
  editSections: {
    short: 'Adding or removing sections is managed by your operator.',
    requestLabel: 'Request a section change',
  },
  editTheme: {
    short: 'Brand and theme are managed by your operator.',
    requestLabel: 'Request a brand change',
  },
  editPages: {
    short: 'Pages are managed by your operator.',
    requestLabel: 'Request a new page',
  },
  useAI: {
    short: "AI tools aren't enabled for your account.",
    requestLabel: 'Request AI access',
  },
  publish: {
    short: 'Only your operator can publish changes.',
    requestLabel: 'Submit for review instead',
  },
  approve: {
    short: 'Approval is admin-only.',
    requestLabel: '',
  },
  rollback: {
    short: 'Rollback is managed by your operator.',
    requestLabel: 'Request a rollback',
  },
  manageDomain: {
    short: 'Domain settings are managed by your operator.',
    requestLabel: 'Request a domain change',
  },
};
