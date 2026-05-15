// =============================================================================
// STUB — force-publish audit log shape + example entries.
//
// The real audit log fires whenever an admin uses the "Force publish (skip
// approval)" affordance — Session 5+. The shape is captured here in 1b so
// the surface in /settings/access can be designed and reviewed alongside
// the capability grid. Replace with backend-resolved entries when the
// publish flow lands.
// =============================================================================

export type ForcePublishEntry = {
  id: string;
  /** ISO 8601 timestamp. */
  at: string;
  /** Who triggered the force-publish. */
  actor: { displayName: string; email: string };
  /** Which client + website the publish affected. */
  target: { clientName: string; websiteId: string; pageTitle: string };
  /** Required free-text reason captured at confirm-time. */
  reason: string;
  /** Version id that became live as a result. */
  newVersionId: string;
};

export const STUB_FORCE_PUBLISH_LOG: ForcePublishEntry[] = [
  {
    id: 'fp-001',
    at: '2026-05-12T22:47:00+08:00',
    actor: { displayName: 'Craig', email: 'craig@webnua.com' },
    target: {
      clientName: 'FreshHome',
      websiteId: 'website-freshhome',
      pageTitle: 'Emergency cleanup landing',
    },
    reason:
      'Anna sent a panicked SMS — wrong phone number went live overnight. Skipping review queue to fix.',
    newVersionId: 'v-2026-05-12T22-47',
  },
  {
    id: 'fp-002',
    at: '2026-04-28T09:12:00+08:00',
    actor: { displayName: 'Craig', email: 'craig@webnua.com' },
    target: {
      clientName: 'KeyHero',
      websiteId: 'website-keyhero',
      pageTitle: 'Schedule a callout',
    },
    reason:
      'Form submit endpoint returning 500 — emergency revert to last known-good template version.',
    newVersionId: 'v-2026-04-28T09-12',
  },
];
