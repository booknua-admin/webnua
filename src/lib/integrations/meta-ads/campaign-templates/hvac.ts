// Phase 7 Meta Ads — campaign template: HVAC.
//
// Heating / cooling / ventilation. Seasonal lift in summer (AC repair) and
// autumn (boiler service). Hooks: same-day repair, energy efficiency, no-quibble
// quotes. Older audience skew than other trades (people who own bigger homes).

import type { CampaignTemplate } from './types';

export const HVAC_TEMPLATE: CampaignTemplate = {
  slug: 'hvac',
  displayName: 'HVAC — heating, cooling, ventilation',
  description:
    'Lead-gen ads for HVAC services. Hooks same-day repair and seasonal efficiency.',
  suggestedDailyBudgetMajor: 7,

  campaignNameTemplate: '{businessName} · Lead generation · HVAC',
  adSetNameTemplate: '{businessName} · {serviceArea} · Homeowners 30-70',
  adNameTemplate: '{businessName} · Heating + cooling · v1',
  leadFormNameTemplate: '{businessName} · HVAC quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 30,
    ageMin: 30,
    ageMax: 70,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs
      'home improvement',
      'energy efficiency',
      'real estate',
      'sustainability',
    ],
    behaviorLabels: ['homeowners'],
  },

  copy: {
    primaryText:
      'Heating playing up? AC not keeping the house cool? Boiler due a service? {businessName} provides full HVAC services across {serviceArea}. Same-day repair appointments + free no-obligation quotes for installs.',
    headline: 'HVAC trouble? Get a free quote.',
    description: 'Same-day repair · 12-month workmanship guarantee',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'service_type',
      label: 'What do you need? (boiler service / AC repair / new install / other)',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'property_type',
      label: 'Property type (house, apartment, commercial)',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code (IE default).',
    'Resolve interest labels to real Meta interest IDs.',
    'Wire the privacy-policy URL.',
    'Upload imagery and capture the image_hash.',
    'Consider seasonal copy variants — autumn = boiler service, summer = AC.',
  ],
};
