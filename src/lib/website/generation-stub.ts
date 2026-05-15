// =============================================================================
// generation-stub — Session 6's stub form-to-page generator.
//
// Synthetic delay 4–8s. Output deterministic on (pageType, primaryIntent,
// audience) — see design doc generation §6. The free-text `specifics` and
// `avoid` answers are received but NOT consumed by the stub; the generation
// card surfaces "received, will be used" framing rather than echoing them
// inline with phase copy (§1 framing rule).
//
// Validation pipeline (§4.4) runs on the recipe output the same way it will
// on real model output: drop invalid section types, drop invalid containers,
// per-field validation with defaultData fallback. Fallbacks are logged for
// prompt tuning (§4.4a). The recipes are constructed clean so the validation
// pipeline doesn't fire on stub output in practice — but the path is wired
// end-to-end so the dev surface (§6a) shows the validation log structure.
//
// Replace with a real backend call when the LLM lands; the GenerationContext
// → GeneratedPage contract stays identical.
// =============================================================================

import type { GenerationContext, PrimaryIntent, Audience } from './generation-context';
import { getSectionDefinition } from './sections';
import type {
  Page,
  PageSEO,
  PageType,
  Section,
  SectionType,
} from './types';

export type GeneratedSection = {
  type: SectionType;
  enabled: true;
  data: Record<string, unknown>;
  /** Field names the recipe populated. Drives `section.ai.draftedFields`. */
  populatedFields: string[];
};

export type GeneratedPage = {
  title: string;
  slug: string;
  type: PageType;
  seo: PageSEO;
  sections: GeneratedSection[];
};

export type GenerationResult = {
  generationId: string;
  page: Page;
  fallbackLog: FallbackLogEntry[];
  droppedSections: DroppedSectionLog[];
};

export type FallbackLogEntry = {
  generationId: string;
  sectionType: SectionType;
  fieldName: string;
  reason: 'missing' | 'invalid';
  modelValue?: unknown;
};

export type DroppedSectionLog = {
  generationId: string;
  type: string;
  reason: 'unknown-type' | 'invalid-container' | 'invalid-page-type';
};

// -- Phase copy (for the generation card) -----------------------------------

export const GENERATION_PHASES = [
  'Reading your brand…',
  'Choosing sections…',
  'Writing copy…',
] as const;

export function randomDelayMs(): number {
  return Math.floor(Math.random() * 4000) + 4000;
}

// -- Recipes ----------------------------------------------------------------

const RECIPES: Record<PageType, readonly SectionType[]> = {
  home: ['hero', 'offer', 'trust', 'services', 'reviews', 'faq', 'cta'],
  services: ['hero', 'services', 'trust', 'reviews', 'cta'],
  about: ['hero', 'trust', 'reviews', 'cta'],
  contact: ['hero', 'cta', 'trust'],
  generic: ['hero', 'offer', 'trust', 'services', 'reviews', 'faq', 'cta'],
};

export function recipeFor(pageType: PageType): readonly SectionType[] {
  return RECIPES[pageType];
}

// -- Voice variants for copy ------------------------------------------------

type VoiceVariant = 'cold-ad-urgent' | 'existing-calm' | 'search-plain';

function voiceFor(audience: Audience): VoiceVariant {
  switch (audience) {
    case 'cold-ad':
      return 'cold-ad-urgent';
    case 'existing':
    case 'referral':
      return 'existing-calm';
    case 'search':
      return 'search-plain';
    case 'mixed':
      return 'existing-calm';
  }
}

// -- Public entry point -----------------------------------------------------

/** The Session 6 stub generator. Async (with synthetic delay) so the call
 *  site can mount a progress card; real backend implements the same shape. */
export async function generatePageStub(
  ctx: GenerationContext,
  options?: { signal?: AbortSignal; instantForDev?: boolean },
): Promise<GenerationResult> {
  if (!options?.instantForDev) {
    await delay(randomDelayMs(), options?.signal);
  }
  return generateSync(ctx);
}

/** Synchronous variant for the dev preview surface (no delay). */
export function generateSync(ctx: GenerationContext): GenerationResult {
  const generationId = `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const recipe = recipeFor(ctx.pageType);
  const voice = voiceFor(ctx.audience);

  const rawSections: GeneratedSection[] = recipe.map((type) =>
    populateSection(type, ctx, voice),
  );

  const { sections, fallbackLog, droppedSections } = runValidationPipeline(
    rawSections,
    ctx,
    generationId,
  );

  const title = inferPageTitle(ctx);
  const slug = inferSlug(title);
  const page: Page = {
    id: generationId,
    websiteId: '__pending__',
    slug,
    title,
    type: ctx.pageType,
    sections: sections.map(toSection),
    seo: defaultSeo(title, ctx),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return { generationId, page, fallbackLog, droppedSections };
}

// -- Validation pipeline (§4.4) ---------------------------------------------

function runValidationPipeline(
  sections: GeneratedSection[],
  ctx: GenerationContext,
  generationId: string,
): {
  sections: GeneratedSection[];
  fallbackLog: FallbackLogEntry[];
  droppedSections: DroppedSectionLog[];
} {
  const fallbackLog: FallbackLogEntry[] = [];
  const droppedSections: DroppedSectionLog[] = [];
  const kept: GeneratedSection[] = [];

  for (const s of sections) {
    const def = getSectionDefinition(s.type);
    if (!def) {
      droppedSections.push({
        generationId,
        type: s.type,
        reason: 'unknown-type',
      });
      continue;
    }
    if (!def.allowedContainers.includes('page')) {
      droppedSections.push({
        generationId,
        type: s.type,
        reason: 'invalid-container',
      });
      continue;
    }
    if (
      def.allowedPageTypes &&
      def.allowedPageTypes.length > 0 &&
      !def.allowedPageTypes.includes(ctx.pageType)
    ) {
      droppedSections.push({
        generationId,
        type: s.type,
        reason: 'invalid-page-type',
      });
      continue;
    }
    // Per-field validation: any required field missing/empty → fallback,
    // strip from populatedFields (no AI tag) and log.
    const example = def.defaultData() as Record<string, unknown>;
    const data = { ...s.data };
    const populated = new Set(s.populatedFields);
    for (const key of Object.keys(example)) {
      const value = data[key];
      if (value === undefined || value === null) {
        data[key] = example[key];
        populated.delete(key);
        fallbackLog.push({
          generationId,
          sectionType: s.type,
          fieldName: key,
          reason: 'missing',
        });
      }
    }
    kept.push({
      ...s,
      data,
      populatedFields: Array.from(populated),
    });
  }
  return { sections: kept, fallbackLog, droppedSections };
}

function toSection(g: GeneratedSection): Section {
  return {
    id: `sec-${Math.random().toString(36).slice(2, 9)}`,
    type: g.type,
    enabled: true,
    data: g.data,
    ai: {
      draftedFields: g.populatedFields,
      lastRegenAt: nowIso(),
    },
  };
}

// -- Per-section copy library -----------------------------------------------

function populateSection(
  type: SectionType,
  ctx: GenerationContext,
  voice: VoiceVariant,
): GeneratedSection {
  const filler = SECTION_FILLERS[type];
  if (!filler) {
    // Unknown type in a recipe — never happens for valid recipes but the
    // pipeline drops it cleanly. Empty data + no populated fields.
    return { type, enabled: true, data: {}, populatedFields: [] };
  }
  return filler(ctx, voice);
}

type FillerFn = (
  ctx: GenerationContext,
  voice: VoiceVariant,
) => GeneratedSection;

const SECTION_FILLERS: Partial<Record<SectionType, FillerFn>> = {
  hero: fillHero,
  offer: fillOffer,
  trust: fillTrust,
  services: fillServices,
  reviews: fillReviews,
  faq: fillFaq,
  cta: fillCta,
};

function fillHero(ctx: GenerationContext, voice: VoiceVariant): GeneratedSection {
  const intentLabel = intentCtaLabel(ctx.primaryIntent);
  const businessNoun = nounFor(ctx);
  const headline = pick(voice, {
    'cold-ad-urgent': `${businessNoun} — sorted same day.`,
    'existing-calm': `Welcome back. Here for whatever ${businessNoun.toLowerCase()} you need.`,
    'search-plain': `${businessNoun} you can actually rely on.`,
  });
  const sub = pick(voice, {
    'cold-ad-urgent':
      'Local, licensed, on call. Fixed callout, written quote before we start, guaranteed work.',
    'existing-calm':
      'You already know the drill — same crew, same quality, same fair pricing. Book in below.',
    'search-plain':
      "Read what we do, see our pricing, and book when you're ready. No phone-call gauntlet.",
  });
  return {
    type: 'hero',
    enabled: true,
    data: {
      eyebrow: ctx.brand.industryCategory.toUpperCase(),
      headline,
      sub,
      ctaPrimaryLabel: intentLabel,
      ctaPrimaryHref: intentHref(ctx.primaryIntent),
      ctaSecondaryLabel: 'Call now',
      ctaSecondaryHref: 'tel:0400000000',
      heroImageUrl: '',
    },
    populatedFields: [
      'eyebrow',
      'headline',
      'sub',
      'ctaPrimaryLabel',
      'ctaPrimaryHref',
      'ctaSecondaryLabel',
      'ctaSecondaryHref',
    ],
  };
}

function fillOffer(ctx: GenerationContext, voice: VoiceVariant): GeneratedSection {
  const intentLabel = intentCtaLabel(ctx.primaryIntent);
  const title = pick(voice, {
    'cold-ad-urgent': 'First callout — fixed price, no surprises.',
    'existing-calm': 'The standard — what most jobs cost.',
    'search-plain': "What you'll pay for a typical job.",
  });
  const inclusions = [
    'Licensed tradesperson on-site',
    'Diagnosis + written quote before work starts',
    '12-month workmanship guarantee',
    'No callout surcharge after hours',
  ].join('\n');
  return {
    type: 'offer',
    enabled: true,
    data: {
      tag: '// OFFER',
      title,
      priceLabel: '$99',
      priceCaption: 'Fixed callout',
      includedText: inclusions,
      scarcityCopy: 'Same-day slots fill by mid-morning.',
      ctaLabel: intentLabel,
      ctaHref: intentHref(ctx.primaryIntent),
    },
    populatedFields: [
      'tag',
      'title',
      'priceLabel',
      'priceCaption',
      'includedText',
      'scarcityCopy',
      'ctaLabel',
      'ctaHref',
    ],
  };
}

function fillTrust(ctx: GenerationContext): GeneratedSection {
  const ratingSource =
    ctx.audience === 'cold-ad'
      ? 'Google · 184 verified reviews'
      : 'Google reviews';
  return {
    type: 'trust',
    enabled: true,
    data: {
      intro: '// TRUSTED',
      ratingValue: '4.9',
      ratingMax: '5.0',
      ratingSource,
      yearsLabel: '8 yrs in business',
      licenceLabel: 'Lic #12345',
      guaranteeLabel: '12-mo workmanship guarantee',
    },
    populatedFields: [
      'intro',
      'ratingValue',
      'ratingMax',
      'ratingSource',
      'yearsLabel',
      'licenceLabel',
      'guaranteeLabel',
    ],
  };
}

function fillServices(ctx: GenerationContext, voice: VoiceVariant): GeneratedSection {
  const intro = pick(voice, {
    'cold-ad-urgent': 'Fixed prices on the common stuff. Free quote on the rest.',
    'existing-calm': "Here's what we do most often, with pricing up front.",
    'search-plain': 'Every service we offer, with what it typically costs.',
  });
  return {
    type: 'services',
    enabled: true,
    data: {
      title: 'What we do',
      intro,
      services: [
        {
          id: `svc-${rid()}`,
          name: 'Emergency callout',
          priceFrom: 'From $99',
          durationLabel: '1h response',
          description: 'Lights out, no power, breaker tripping — same-day fix.',
        },
        {
          id: `svc-${rid()}`,
          name: 'New install + upgrade',
          priceFrom: 'Free quote',
          durationLabel: 'On request',
          description:
            'Switchboard upgrades, EV chargers, ceiling fans, downlights, rewires.',
        },
        {
          id: `svc-${rid()}`,
          name: 'Safety inspection',
          priceFrom: 'From $149',
          durationLabel: '60-90 min',
          description: 'Full house safety check + written report. Insurance-ready.',
        },
      ],
    },
    populatedFields: ['title', 'intro', 'services'],
  };
}

function fillReviews(): GeneratedSection {
  return {
    type: 'reviews',
    enabled: true,
    data: {
      title: 'What customers say',
      intro: 'Recent reviews on Google.',
      reviews: [
        {
          id: `rev-${rid()}`,
          author: 'Sarah K.',
          rating: 5,
          body: 'Out in 40 min, fixed and gone in another 30. Honest pricing.',
          age: '2 weeks ago',
        },
        {
          id: `rev-${rid()}`,
          author: 'Mark R.',
          rating: 5,
          body: 'Switchboard upgrade. Quote was the final invoice. Rare these days.',
          age: '1 month ago',
        },
        {
          id: `rev-${rid()}`,
          author: 'Jules T.',
          rating: 5,
          body: 'Booked Saturday night, came Sunday morning. Saved a freezer of food.',
          age: '1 month ago',
        },
      ],
    },
    populatedFields: ['title', 'intro', 'reviews'],
  };
}

function fillFaq(ctx: GenerationContext): GeneratedSection {
  return {
    type: 'faq',
    enabled: true,
    data: {
      title: 'Common questions',
      intro: '',
      items: [
        {
          id: `faq-${rid()}`,
          question: 'How fast can you come out?',
          answer: 'Usually within the hour during business hours. Same day for after-hours.',
        },
        {
          id: `faq-${rid()}`,
          question: "What's the callout fee?",
          answer:
            "$99 fixed. That's diagnosis + written quote. No surprises before we start work.",
        },
        {
          id: `faq-${rid()}`,
          question: 'Are you licensed and insured?',
          answer: `Yes — Lic #12345, fully insured. ${ctx.brand.industryCategory} only.`,
        },
      ],
    },
    populatedFields: ['title', 'items'],
  };
}

function fillCta(ctx: GenerationContext, voice: VoiceVariant): GeneratedSection {
  const headline = pick(voice, {
    'cold-ad-urgent': `${nounFor(ctx)} at your door this hour.`,
    'existing-calm': 'Book the next one when it suits you.',
    'search-plain': 'When you’re ready, book in below.',
  });
  return {
    type: 'cta',
    enabled: true,
    data: {
      tag: '// READY?',
      headline,
      sub: 'One call, fixed callout, written quote on arrival.',
      ctaLabel: intentCtaLabel(ctx.primaryIntent),
      ctaHref: intentHref(ctx.primaryIntent),
    },
    populatedFields: ['tag', 'headline', 'sub', 'ctaLabel', 'ctaHref'],
  };
}

// -- Per-section copy helpers ----------------------------------------------

function intentCtaLabel(intent: PrimaryIntent): string {
  switch (intent.kind) {
    case 'book':
      return 'Book a callout';
    case 'call':
      return 'Call now';
    case 'quote':
      return 'Get a quote';
    case 'signup':
      return 'Sign up';
    case 'read':
      return 'Read more';
    case 'other':
      return 'Get in touch';
  }
}

function intentHref(intent: PrimaryIntent): string {
  switch (intent.kind) {
    case 'book':
      return '/schedule';
    case 'call':
      return 'tel:0400000000';
    case 'quote':
      return '/quote';
    case 'signup':
      return '/signup';
    case 'read':
      return '#';
    case 'other':
      return '/contact';
  }
}

function nounFor(ctx: GenerationContext): string {
  return ctx.brand.industryCategory || 'Local trade';
}

function pick<T extends string>(voice: VoiceVariant, map: Record<VoiceVariant, T>): T {
  return map[voice];
}

// -- Page-level helpers -----------------------------------------------------

function inferPageTitle(ctx: GenerationContext): string {
  switch (ctx.pageType) {
    case 'services':
      return 'Services';
    case 'about':
      return 'About us';
    case 'contact':
      return 'Contact';
    case 'home':
      return 'Home';
    case 'generic':
      return campaignTitleFor(ctx);
  }
}

function campaignTitleFor(ctx: GenerationContext): string {
  switch (ctx.primaryIntent.kind) {
    case 'book':
      return 'Book a callout';
    case 'call':
      return 'Call us today';
    case 'quote':
      return 'Get a quote';
    case 'signup':
      return 'Sign up';
    case 'read':
      return 'Read more';
    case 'other':
      return 'Landing page';
  }
}

function inferSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function defaultSeo(title: string, ctx: GenerationContext): PageSEO {
  return {
    title: `${title} — ${ctx.brand.industryCategory}`,
    description: ctx.brand.audienceLine,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function rid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
