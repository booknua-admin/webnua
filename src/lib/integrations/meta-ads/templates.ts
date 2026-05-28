// =============================================================================
// Meta Ad Templates — one lead-form campaign template per Webnua industry.
//
// Phase 7.5 Session 1. Stable defaults the launch wizard seeds when the
// operator picks a template; every field stays editable in the wizard,
// so a template that doesn't quite fit a particular customer can be
// tuned without leaving Webnua.
//
// Keys match `IndustryKey` from `lib/website/industry-templates.ts` —
// adding a new trade adds one entry here, one in industry-templates, and
// one in industry-colors. Single source of truth: the IndustryKey union.
//
// V1 scope: lead-form (OUTCOME_LEADS) only. Each template carries:
//   • defaultDailyBudgetCents — industry-typical floor where Meta will
//     deliver a meaningful number of leads. Lower = noisy CPL; the
//     wizard surfaces this as a recommendation, not a constraint.
//   • defaultAgeRange — broad for local services. Trade-specific
//     narrowing (e.g. roofer skews older homeowners) lives here.
//   • interestTokens — Meta interest GUID tokens that index the trade's
//     audience. V1 leaves these as suggested keywords (operator can
//     resolve to Meta interest ids in Ads Manager later); we store the
//     keywords on meta_campaign_launches.targeting_interest_tokens so
//     the training pipeline can correlate them to outcomes.
//   • leadFormQuestions — Meta's closed enum of standard prefilled
//     questions (FULL_NAME / EMAIL / PHONE / CITY) + zero or one custom
//     question per template ("What service do you need?" for handyman,
//     etc.). Keeping the form short is the #1 lead-volume lever.
//   • copyTemplates — headline / primaryText / description / ctaType.
//     Placeholders: {businessName} {serviceArea} {service}. The wizard
//     pre-fills these substituted; the operator can edit any field.
//
// Targeting geometry (lat/lng + radius) is captured per-launch, not
// per-template — the radius default is here as a hint.
//
// SERVER + CLIENT safe — pure data.
// =============================================================================

import type { IndustryKey } from '@/lib/website/industry-templates';

// --- shape -------------------------------------------------------------------

export type MetaLeadFormQuestion = {
  /** Meta's predefined question type ('FULL_NAME' / 'EMAIL' / 'PHONE' /
   *  'CITY') OR 'CUSTOM' for a free-form question. */
  type:
    | 'FULL_NAME'
    | 'EMAIL'
    | 'PHONE'
    | 'CITY'
    | 'POST_CODE'
    | 'STREET_ADDRESS'
    | 'CUSTOM';
  /** Required when type === 'CUSTOM' — the operator-facing question text. */
  label?: string;
  /** Stable key used to map answers to lead_events.payload fields. */
  key?: string;
};

export type MetaAdTemplate = {
  /** Industry slug (matches IndustryKey). */
  slug: IndustryKey;
  /** Operator-facing label. */
  label: string;
  /** One-line description on the picker card. */
  blurb: string;
  /** Campaign objective — V1 always OUTCOME_LEADS. */
  objective: 'OUTCOME_LEADS';
  /** Suggested daily budget in cents (minor units). Wizard step 3 seeds
   *  this; the operator can adjust. */
  defaultDailyBudgetCents: number;
  /** Suggested geographic radius in km from the customer's address. */
  defaultRadiusKm: number;
  /** Age range default — broad for V1. */
  defaultAgeMin: number;
  defaultAgeMax: number;
  /** Suggested Meta interest keywords. V1 stores these as strings on
   *  meta_campaign_launches; future iterations can resolve to Meta's
   *  numeric interest ids. */
  interestTokens: string[];
  /** Lead-form questions — keep short (3–5 fields beats 6+ on CR). */
  leadFormQuestions: MetaLeadFormQuestion[];
  /** Copy templates with {placeholder} substitutions. */
  copyTemplates: {
    headline: string;
    primaryText: string;
    description: string;
    ctaType: 'LEARN_MORE' | 'BOOK_NOW' | 'GET_QUOTE' | 'CONTACT_US' | 'SIGN_UP';
  };
};

// --- standard question presets ----------------------------------------------

const COMMON_QUESTIONS: MetaLeadFormQuestion[] = [
  { type: 'FULL_NAME' },
  { type: 'EMAIL' },
  { type: 'PHONE' },
  { type: 'CITY' },
];

// --- per-industry templates -------------------------------------------------

export const META_AD_TEMPLATES: Record<IndustryKey, MetaAdTemplate> = {
  electrician: {
    slug: 'electrician',
    label: 'Electrician — emergency call-out',
    blurb:
      'Local emergency electrical service: fast-response framing, broad audience, GET_QUOTE CTA.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 3500,
    defaultRadiusKm: 25,
    defaultAgeMin: 25,
    defaultAgeMax: 65,
    interestTokens: ['home improvement', 'home ownership', 'electrical work'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'Need an electrician in {serviceArea}?',
      primaryText:
        '{businessName} — fast, local, fully licensed. Same-day call-outs for power outages, dodgy switches, safety checks. Get a fixed quote in minutes.',
      description: 'Local · Licensed · Fixed-price quotes',
      ctaType: 'GET_QUOTE',
    },
  },

  plumber: {
    slug: 'plumber',
    label: 'Plumber — emergency call-out',
    blurb:
      'Local plumbing service: leak / burst pipe urgency framing, broad audience, GET_QUOTE CTA.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 3500,
    defaultRadiusKm: 25,
    defaultAgeMin: 25,
    defaultAgeMax: 65,
    interestTokens: ['home improvement', 'home ownership', 'plumbing'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'Burst pipe? Blocked drain? We can help.',
      primaryText:
        '{businessName} — local {serviceArea} plumbers. Fast call-outs, transparent pricing, no surprises on the invoice. Get a quote today.',
      description: 'Local · Licensed · No surprise pricing',
      ctaType: 'GET_QUOTE',
    },
  },

  cleaner: {
    slug: 'cleaner',
    label: 'Cleaner — regular & one-off bookings',
    blurb:
      'House / office cleaning: BOOK_NOW CTA, fortnightly framing as the conversion target.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 2500,
    defaultRadiusKm: 20,
    defaultAgeMin: 28,
    defaultAgeMax: 60,
    interestTokens: ['home cleaning', 'house cleaning', 'home services'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'Take cleaning off your to-do list.',
      primaryText:
        '{businessName} — trusted {serviceArea} cleaners. One-off cleans or fortnightly regulars. Vetted, insured, easy to book. Get a free quote.',
      description: 'Vetted · Insured · Easy to book',
      ctaType: 'BOOK_NOW',
    },
  },

  landscaper: {
    slug: 'landscaper',
    label: 'Landscaper — quote requests',
    blurb:
      'Garden / outdoor work: GET_QUOTE CTA, project-size framing, broader homeowner audience.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 4000,
    defaultRadiusKm: 35,
    defaultAgeMin: 30,
    defaultAgeMax: 65,
    interestTokens: ['gardening', 'landscaping', 'home ownership'],
    leadFormQuestions: [
      ...COMMON_QUESTIONS,
      {
        type: 'CUSTOM',
        key: 'project_size',
        label: 'Roughly how big is the project? (small / medium / large)',
      },
    ],
    copyTemplates: {
      headline: 'Transform your outdoor space.',
      primaryText:
        '{businessName} — landscapers serving {serviceArea}. From a tidy-up to a full redesign. Free quote, no obligation.',
      description: 'Local · Insured · Free quotes',
      ctaType: 'GET_QUOTE',
    },
  },

  roofer: {
    slug: 'roofer',
    label: 'Roofer — repair & replacement quotes',
    blurb:
      'Roofing service: urgency framing for leaks / damage, older homeowner skew.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 4500,
    defaultRadiusKm: 30,
    defaultAgeMin: 35,
    defaultAgeMax: 70,
    interestTokens: ['home improvement', 'roofing', 'home ownership'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'Roof leaking? Storm damage?',
      primaryText:
        '{businessName} — {serviceArea} roofers. Emergency call-outs, full replacements, insurance work. Free quote within 24 hours.',
      description: 'Licensed · Insured · Free quotes',
      ctaType: 'GET_QUOTE',
    },
  },

  painter: {
    slug: 'painter',
    label: 'Painter — interior & exterior',
    blurb:
      'House painting: project framing, homeowner audience, GET_QUOTE CTA.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 3000,
    defaultRadiusKm: 25,
    defaultAgeMin: 28,
    defaultAgeMax: 65,
    interestTokens: ['home improvement', 'interior design', 'home ownership'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'Painters who actually turn up.',
      primaryText:
        '{businessName} — interior + exterior painting across {serviceArea}. Tidy work, sharp lines, no half-finished jobs. Free quote.',
      description: 'Tidy · On time · Free quotes',
      ctaType: 'GET_QUOTE',
    },
  },

  hvac: {
    slug: 'hvac',
    label: 'HVAC — heating, cooling, repairs',
    blurb:
      'HVAC service: seasonal urgency framing, homeowner audience.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 4000,
    defaultRadiusKm: 30,
    defaultAgeMin: 30,
    defaultAgeMax: 65,
    interestTokens: ['hvac', 'home improvement', 'air conditioning'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'No heat? No cool? We can be there today.',
      primaryText:
        '{businessName} — HVAC repairs across {serviceArea}. Same-day call-outs, transparent pricing, no upsell. Get a quote in minutes.',
      description: 'Same-day · Licensed · Honest pricing',
      ctaType: 'GET_QUOTE',
    },
  },

  locksmith: {
    slug: 'locksmith',
    label: 'Locksmith — emergency lockout & rekeying',
    blurb:
      'Locksmith service: urgency framing (locked out), broad audience.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 3000,
    defaultRadiusKm: 30,
    defaultAgeMin: 22,
    defaultAgeMax: 65,
    interestTokens: ['home security', 'home ownership'],
    leadFormQuestions: [
      { type: 'FULL_NAME' },
      { type: 'PHONE' },
      { type: 'CITY' },
    ],
    copyTemplates: {
      headline: 'Locked out? We can be there fast.',
      primaryText:
        '{businessName} — local locksmiths across {serviceArea}. Lockouts, rekeying, broken keys. Call us, we move.',
      description: 'Fast · Local · Licensed',
      ctaType: 'CONTACT_US',
    },
  },

  handyman: {
    slug: 'handyman',
    label: 'Handyman — small jobs',
    blurb:
      'Handyman service: list-of-services framing, BOOK_NOW CTA.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 2500,
    defaultRadiusKm: 20,
    defaultAgeMin: 28,
    defaultAgeMax: 65,
    interestTokens: ['home improvement', 'DIY', 'home ownership'],
    leadFormQuestions: [
      ...COMMON_QUESTIONS,
      {
        type: 'CUSTOM',
        key: 'service',
        label: 'What needs doing?',
      },
    ],
    copyTemplates: {
      headline: 'That to-do list — sorted.',
      primaryText:
        '{businessName} — handyman across {serviceArea}. Shelves, gates, leaky taps, the lot. Book a slot, we turn up, the job gets done.',
      description: 'Local · Insured · Easy to book',
      ctaType: 'BOOK_NOW',
    },
  },

  carpenter: {
    slug: 'carpenter',
    label: 'Carpenter — custom work',
    blurb:
      'Carpentry: project framing for built-ins / decks / repairs, GET_QUOTE CTA.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 3500,
    defaultRadiusKm: 30,
    defaultAgeMin: 30,
    defaultAgeMax: 65,
    interestTokens: ['home improvement', 'carpentry', 'home ownership'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'Built right. Built local.',
      primaryText:
        '{businessName} — carpentry across {serviceArea}. Built-ins, decks, custom work, repairs. Free quote, fixed price.',
      description: 'Local · Insured · Free quotes',
      ctaType: 'GET_QUOTE',
    },
  },

  generic: {
    slug: 'generic',
    label: 'Generic local service',
    blurb:
      'Industry-agnostic local service template. Use when the customer\'s trade doesn\'t match a specific template above.',
    objective: 'OUTCOME_LEADS',
    defaultDailyBudgetCents: 3000,
    defaultRadiusKm: 25,
    defaultAgeMin: 25,
    defaultAgeMax: 65,
    interestTokens: ['local services', 'home services'],
    leadFormQuestions: COMMON_QUESTIONS,
    copyTemplates: {
      headline: 'Local. Reliable. {businessName}.',
      primaryText:
        '{businessName} — serving {serviceArea}. Easy to book, easy to deal with. Get a free quote today.',
      description: 'Local · Reliable · Free quotes',
      ctaType: 'GET_QUOTE',
    },
  },
};

// --- copy substitution -------------------------------------------------------

export type CopySubstitutions = {
  businessName: string;
  serviceArea: string;
  service?: string;
};

const PLACEHOLDER_RE = /\{(businessName|serviceArea|service)\}/g;

/** Substitute {businessName} / {serviceArea} / {service} placeholders in
 *  template copy. Unknown placeholders are left intact so a mis-spelled
 *  key fails visibly rather than silently disappearing. */
export function substituteCopy(
  template: string,
  values: CopySubstitutions,
): string {
  return template.replace(PLACEHOLDER_RE, (_match, key: keyof CopySubstitutions) => {
    const value = values[key];
    return typeof value === 'string' && value.length > 0 ? value : `{${key}}`;
  });
}

/** Resolve copy templates to substituted strings. */
export function resolveTemplateCopy(
  template: MetaAdTemplate,
  values: CopySubstitutions,
): {
  headline: string;
  primaryText: string;
  description: string;
  ctaType: MetaAdTemplate['copyTemplates']['ctaType'];
} {
  return {
    headline: substituteCopy(template.copyTemplates.headline, values),
    primaryText: substituteCopy(template.copyTemplates.primaryText, values),
    description: substituteCopy(template.copyTemplates.description, values),
    ctaType: template.copyTemplates.ctaType,
  };
}

/** Get the template for an industry, falling back to 'generic' for
 *  unmapped values (defensive — the wizard's picker only shows
 *  IndustryKey values, but a stale brand row could carry a custom
 *  industry string). */
export function templateForIndustry(industry: string | null | undefined): MetaAdTemplate {
  if (industry && industry in META_AD_TEMPLATES) {
    return META_AD_TEMPLATES[industry as IndustryKey];
  }
  return META_AD_TEMPLATES.generic;
}

/** All available templates in display order (specific industries first,
 *  generic last as the catch-all). */
export function listTemplates(): MetaAdTemplate[] {
  const keys = Object.keys(META_AD_TEMPLATES) as IndustryKey[];
  return keys
    .sort((a, b) => {
      if (a === 'generic') return 1;
      if (b === 'generic') return -1;
      return a.localeCompare(b);
    })
    .map((k) => META_AD_TEMPLATES[k]);
}
