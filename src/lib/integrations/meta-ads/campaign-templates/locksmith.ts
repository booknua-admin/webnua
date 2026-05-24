// Phase 7 Meta Ads — campaign template: locksmith.
//
// Almost entirely emergency-driven. Targeting concentric around the service
// area; broader age range; emphasis on response time.

import type { CampaignTemplate } from './types';

export const LOCKSMITH_TEMPLATE: CampaignTemplate = {
  slug: 'locksmith',
  displayName: 'Locksmith — emergency call-outs',
  description:
    'Lead-gen ads for residential / commercial locksmiths. Almost entirely emergency-driven.',
  suggestedDailyBudgetMajor: 7,

  campaignNameTemplate: '{businessName} · Lead generation · Locksmith',
  adSetNameTemplate: '{businessName} · {serviceArea} · All-adults',
  adNameTemplate: '{businessName} · Locked out · v1',
  leadFormNameTemplate: '{businessName} · Locksmith quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 20,
    ageMin: 18,
    ageMax: 75,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs
      'home security',
      'real estate',
    ],
    behaviorLabels: ['homeowners', 'renters', 'small business owners'],
  },

  copy: {
    primaryText:
      'Locked out? Lost keys? Broken lock? Need a security upgrade? {businessName} provides fast emergency locksmith service across {serviceArea}. Mobile vans, all major brands, transparent pricing.',
    headline: 'Locked out in {serviceArea}?',
    description: '24/7 mobile · Insured · All brands',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    {
      type: 'CUSTOM',
      key: 'situation',
      label: 'What\'s happening? (locked out / lost keys / broken lock / upgrade)',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'urgency',
      label: 'How urgent? (right now / today / can wait)',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code (IE default).',
    'Resolve interest labels to real Meta interest IDs.',
    'Wire the privacy-policy URL.',
    'Phone-first lead form (some locked-out customers can\'t check email).',
  ],
};
