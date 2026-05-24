// Phase 7 Meta Ads — campaign template: landscaper.
//
// Garden design + maintenance. Seasonal — spring + early summer carry most
// of the year's lead volume. Pause budget Nov-Feb.

import type { CampaignTemplate } from './types';

export const LANDSCAPER_TEMPLATE: CampaignTemplate = {
  slug: 'landscaper',
  displayName: 'Landscaper — garden design + maintenance',
  description:
    'Lead-gen ads for landscapers / garden designers. Highly seasonal — spring + summer carry the year.',
  suggestedDailyBudgetMajor: 7,

  campaignNameTemplate: '{businessName} · Lead generation · Landscaping',
  adSetNameTemplate: '{businessName} · {serviceArea} · Garden homeowners',
  adNameTemplate: '{businessName} · Garden makeover · v1',
  leadFormNameTemplate: '{businessName} · Garden quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 30,
    ageMin: 30,
    ageMax: 70,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs
      'gardening',
      'landscaping',
      'home improvement',
      'outdoor living',
    ],
    behaviorLabels: ['homeowners'],
  },

  copy: {
    primaryText:
      'Garden looking tired? Want to transform an outdoor space, lay a lawn, build a patio, or plan a planting scheme? {businessName} brings garden design and maintenance to {serviceArea}. Free design consultation + fixed-price quote.',
    headline: 'Reimagine your garden this season.',
    description: 'Design + build + maintenance · Free consultation',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'service_type',
      label: 'What are you looking for? (design / landscaping / maintenance / lawn)',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'garden_size',
      label: 'Garden size? (small / medium / large)',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code (IE default).',
    'Resolve interest labels to real Meta interest IDs.',
    'Wire the privacy-policy URL.',
    'Upload before-after garden imagery — landscapers convert on visual proof.',
    'Schedule the campaign to PAUSE Nov-Feb; off-season clicks are mostly wasted spend.',
  ],
};
