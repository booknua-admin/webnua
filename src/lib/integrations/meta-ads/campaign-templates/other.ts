// Phase 7 Meta Ads — campaign template: other (generic service business).
//
// Catch-all for any service trade not covered by a dedicated template.
// Conservative defaults; the operator should review every line before
// launch.

import type { CampaignTemplate } from './types';

export const OTHER_TEMPLATE: CampaignTemplate = {
  slug: 'other',
  displayName: 'Other — generic service business',
  description: 'Catch-all template for any service trade not covered by a dedicated template. Review every line before launch.',
  suggestedDailyBudgetMajor: 7,

  campaignNameTemplate: '{businessName} · Lead generation',
  adSetNameTemplate: '{businessName} · {serviceArea} · Adults 25-65',
  adNameTemplate: '{businessName} · Lead-gen · v1',
  leadFormNameTemplate: '{businessName} · Free quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 25,
    ageMin: 25,
    ageMax: 65,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): pick category-appropriate interest IDs at launch time.
    ],
    behaviorLabels: ['homeowners'],
  },

  copy: {
    primaryText:
      'Need {funnelService} in {serviceArea}? {businessName} delivers reliable service with transparent pricing. {funnelGuarantee} Get a no-obligation quote in minutes.',
    headline: 'Quality {industry} service in {serviceArea}.',
    description: 'Free quote · Trusted local team',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'service_request',
      label: 'What do you need?',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'timing',
      label: 'When do you need it?',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Heavily customise copy — generic template, real industry framing wins.',
    'Pick interest IDs that match this specific trade.',
    'Confirm country code.',
    'Wire the privacy-policy URL.',
    'Upload trade-relevant imagery.',
    'Consider whether {funnelGuarantee} substitution actually reads well — fall back to plain copy if not.',
  ],
};
