// Phase 7 Meta Ads — campaign template: builder.
//
// Residential extensions, renovations, kitchens, bathrooms. Longer lead cycle
// than emergency trades — visitors are researching, not transacting. Hooks:
// portfolio + reviews + before-after photography. Higher CPL is acceptable
// because each lead is higher revenue.

import type { CampaignTemplate } from './types';

export const BUILDER_TEMPLATE: CampaignTemplate = {
  slug: 'builder',
  displayName: 'Builder — extensions + renovations',
  description:
    'Lead-gen ads for residential builders. Hooks portfolio + transparent pricing. Higher acceptable CPL.',
  suggestedDailyBudgetMajor: 10,

  campaignNameTemplate: '{businessName} · Lead generation · Builder',
  adSetNameTemplate: '{businessName} · {serviceArea} · Homeowners 35-65',
  adNameTemplate: '{businessName} · Extensions + renovations · v1',
  leadFormNameTemplate: '{businessName} · Builder quote',

  targeting: {
    countries: ['IE'],
    radiusKm: 30,
    ageMin: 35,
    ageMax: 65,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs
      'home improvement',
      'interior design',
      'real estate',
      'architecture',
      'renovation',
    ],
    behaviorLabels: ['homeowners'],
  },

  copy: {
    primaryText:
      'Thinking about an extension, kitchen renovation, or full house refurb? {businessName} delivers high-quality residential builds across {serviceArea}. Detailed fixed-price quotes, transparent scheduling, portfolio of finished work. Free site visit + quote.',
    headline: 'Planning an extension or renovation?',
    description: 'Fixed quotes · Trusted by 100+ families',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'project_type',
      label: 'Project type? (extension / renovation / new build / other)',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'estimated_budget',
      label: 'Rough budget range?',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'timeline',
      label: 'When are you hoping to start? (next month / 3 months / 6+ months)',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code (IE default).',
    'Resolve interest labels to real Meta interest IDs.',
    'Wire the privacy-policy URL.',
    'Upload BEFORE-AFTER imagery (builders convert on visual proof).',
    'Expect higher CPL than service trades (€20-40); revenue per lead justifies it.',
  ],
};
