// Phase 7 Meta Ads — campaign template: electrician.
//
// Lead-generation campaign tuned for residential / light-commercial electrical
// contractors. Highest-converting hooks for this trade tend to be: emergency
// (after-hours fault, sparks, no power), upfront pricing (fixed-quote vs
// hourly), licensed-and-insured trust. Targeting homeowners in the service
// area; behaviour signals around "recently moved" + "homeowners" lift CPL.

import type { CampaignTemplate } from './types';

export const ELECTRICIAN_TEMPLATE: CampaignTemplate = {
  slug: 'electrician',
  displayName: 'Electrician — emergency call-outs + jobs',
  description:
    'Lead-gen ads for residential electricians. Hooks emergency response + fixed-quote pricing.',
  suggestedDailyBudgetMajor: 7,

  campaignNameTemplate: '{businessName} · Lead generation · Electrician',
  adSetNameTemplate: '{businessName} · {serviceArea} · Homeowners 25-65',
  adNameTemplate: '{businessName} · Emergency electrician · v1',
  leadFormNameTemplate: '{businessName} · Free quote',

  targeting: {
    // Country resolved at launch from the client's address; this is a fallback
    // for clients with no service area on file.
    countries: ['IE'],
    radiusKm: 25,
    ageMin: 25,
    ageMax: 65,
    excludeMinors: true,
    interestLabels: [
      // TODO(meta): resolve to real interest IDs via Targeting Browse API
      'home improvement',
      'do it yourself (DIY)',
      'real estate',
    ],
    behaviorLabels: [
      'homeowners',
      'small business owners',
    ],
  },

  copy: {
    primaryText:
      'Power gone out? Sparking switchboard? Renovation rewire? {businessName} provides licensed, insured emergency and planned electrical work across {serviceArea}. Fixed-price quotes — no callout fee. Get a no-obligation quote in minutes.',
    headline: 'Need an electrician in {serviceArea}?',
    description: 'Licensed · Insured · Fixed-price quotes',
    ctaType: 'GET_QUOTE',
  },

  leadFormQuestions: [
    { type: 'FULL_NAME' },
    { type: 'PHONE' },
    { type: 'EMAIL' },
    {
      type: 'CUSTOM',
      key: 'job_type',
      label: 'What kind of job? (emergency, repair, install, rewire)',
      inputType: 'SHORT_ANSWER',
    },
    {
      type: 'CUSTOM',
      key: 'urgency',
      label: 'How soon do you need it? (today / this week / no rush)',
      inputType: 'SHORT_ANSWER',
    },
  ],

  preLaunchChecklist: [
    'Confirm the country code on targeting (IE default — change for AU / UK / US).',
    'Resolve interest labels to real Meta interest IDs (open Audience Insights, search "home improvement", paste the IDs into the template).',
    'Pin the privacy-policy URL to the client\'s actual policy (Meta requires it for lead forms).',
    'Pick an image asset and upload via Meta Ads Manager → Image Library; paste the image_hash into campaign-launch.ts when wiring the creative.',
  ],
};
