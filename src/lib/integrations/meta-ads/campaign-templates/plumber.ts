// Phase 7 Meta Ads — campaign template: plumber.
//
// Highest-converting hooks for residential plumbing: emergencies (burst pipe,
// blocked drain, no hot water), 24/7 availability, transparent pricing.
// Targeting homeowners + property managers in the service area.

import type { CampaignTemplate } from './types';

export const PLUMBER_TEMPLATE: CampaignTemplate = {
  slug: 'plumber',
  displayName: 'Plumber — emergencies + repairs',
  description:
    'Lead-gen ads for residential / light-commercial plumbers. Hooks 24/7 emergency response.',
  suggestedDailyBudgetMajor: 7,

  campaignNameTemplate: '{businessName} · Lead generation · Plumber',
  adSetNameTemplate: '{businessName} · {serviceArea} · Homeowners 25-65',
  adNameTemplate: '{businessName} · Emergency plumber · v1',
  leadFormNameTemplate: '{businessName} · Plumbing quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 25,
    ageMin: 25,
    ageMax: 65,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs
      'home improvement',
      'real estate',
      'property management',
    ],
    behaviorLabels: ['homeowners', 'small business owners'],
  },

  copy: {
    primaryText:
      'Burst pipe? Blocked drain? No hot water? {businessName} provides licensed, insured plumbing across {serviceArea}. 24/7 emergency response. Transparent pricing — quoted before we start. Reach us in minutes.',
    headline: 'Need a plumber, fast?',
    description: '24/7 · Licensed · No surprise bills',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'problem',
      label: 'What\'s the problem? (burst pipe, drain, hot water, install...)',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'urgency',
      label: 'How urgent? (right now / today / this week)',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code (IE default).',
    'Resolve interest labels to real Meta interest IDs.',
    'Wire the privacy-policy URL.',
    'Upload imagery and capture the image_hash.',
  ],
};
