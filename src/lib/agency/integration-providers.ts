// =============================================================================
// Display metadata for the providers tracked by the `integrationDefaults`
// policy key. The policy stores only a boolean per id (agency-supplied vs
// per-sub-account); the names + copy live here.
//
// The ids MUST match the `sharedProviders` keys seeded in
// lib/agency/agency-policy-stub.ts (AGENCY_POLICY_SEED.integrationDefaults).
// =============================================================================

export type IntegrationProviderMeta = {
  id: string;
  name: string;
  description: string;
};

export const INTEGRATION_PROVIDERS: IntegrationProviderMeta[] = [
  {
    id: 'resend',
    name: 'Resend',
    description: 'Transactional email — confirmations, follow-ups, summaries.',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS — lead alerts, booking reminders, review requests.',
  },
  {
    id: 'meta-ads',
    name: 'Meta Ads',
    description:
      'Ad campaign management. Each client usually runs their own ad account.',
  },
  {
    id: 'gbp',
    name: 'Google Business Profile',
    description:
      'Reviews + business listing — tied to the client’s own Google account.',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Hosting + deployment for published funnels and websites.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description:
      'AI drafting — funnel copy, automation messages, page generation.',
  },
];
