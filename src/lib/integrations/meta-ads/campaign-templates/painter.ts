// Phase 7 Meta Ads — campaign template: painter.
//
// Residential interior + exterior painting. Lead cycle slightly longer than
// emergency trades. Hooks: tidy crew, finish quality, fixed-price quotes.

import type { CampaignTemplate } from './types';

export const PAINTER_TEMPLATE: CampaignTemplate = {
  slug: 'painter',
  displayName: 'Painter — interior + exterior',
  description: 'Lead-gen ads for residential painters. Hooks finish quality + tidy crew + fixed-price quotes.',
  suggestedDailyBudgetMajor: 6,

  campaignNameTemplate: '{businessName} · Lead generation · Painter',
  adSetNameTemplate: '{businessName} · {serviceArea} · Homeowners 30-65',
  adNameTemplate: '{businessName} · Painting quote · v1',
  leadFormNameTemplate: '{businessName} · Painting quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 25,
    ageMin: 30,
    ageMax: 65,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs
      'home improvement',
      'interior design',
      'painting',
      'real estate',
    ],
    behaviorLabels: ['homeowners'],
  },

  copy: {
    primaryText:
      'Tired of dingy walls or peeling exterior paint? {businessName} delivers tidy, on-schedule interior + exterior painting across {serviceArea}. Fixed-price quotes, dust-sheets and drop-cloths used as standard, finishes guaranteed for two years.',
    headline: 'Fresh paint, no mess, fixed price.',
    description: '2-year finish guarantee · Tidy crew · Free quote',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'project_type',
      label: 'Interior, exterior, or both?',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'rooms_or_area',
      label: 'How many rooms / what area?',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code (IE default).',
    'Resolve interest labels to real Meta interest IDs.',
    'Wire the privacy-policy URL.',
    'Upload before-after photography (or stock close-ups of finish work).',
  ],
};
