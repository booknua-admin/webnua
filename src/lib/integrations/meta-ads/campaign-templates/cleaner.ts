// Phase 7 Meta Ads — campaign template: cleaner.
//
// Residential cleaning (regular + one-off). Skews female 30-65, working
// homeowners with disposable income. Hooks: regular service consistency,
// trusted teams, bonded/insured.

import type { CampaignTemplate } from './types';

export const CLEANER_TEMPLATE: CampaignTemplate = {
  slug: 'cleaner',
  displayName: 'Cleaner — residential cleaning',
  description: 'Lead-gen ads for residential cleaning services. Hooks consistent regular service + trust.',
  suggestedDailyBudgetMajor: 6,

  campaignNameTemplate: '{businessName} · Lead generation · Cleaning',
  adSetNameTemplate: '{businessName} · {serviceArea} · Working homeowners',
  adNameTemplate: '{businessName} · Regular cleaning · v1',
  leadFormNameTemplate: '{businessName} · Cleaning quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 20,
    ageMin: 30,
    ageMax: 65,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs
      'cleaning',
      'home and garden',
      'organising',
      'family',
    ],
    behaviorLabels: ['homeowners', 'working professionals'],
  },

  copy: {
    primaryText:
      'Want your home consistently spotless without lifting a finger? {businessName} provides reliable regular and one-off residential cleaning across {serviceArea}. Vetted, insured cleaners. Same team every visit. Free quote — choose a fortnightly, weekly, or one-off plan.',
    headline: 'Free up your weekend.',
    description: 'Vetted teams · Insured · Same cleaner every visit',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'service_frequency',
      label: 'How often? (weekly / fortnightly / one-off / not sure)',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'property_size',
      label: 'Property size? (1-bed / 2-bed / 3-bed / 4+ bed)',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code (IE default).',
    'Resolve interest labels to real Meta interest IDs.',
    'Wire the privacy-policy URL.',
    'Upload imagery showing real (or stock) clean homes; people convert on aspirational scenes.',
  ],
};
