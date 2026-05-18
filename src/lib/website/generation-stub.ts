// =============================================================================
// generation-stub — the form-to-page generator (stub).
//
// Synthetic delay 4–8s. Output is deterministic on (pageType, primaryIntent,
// audience, industry) — see design doc generation §6 — but now carries a
// **design-variety layer**: a deterministic seed drives recipe choice, a
// light/dark band rhythm, per-section layout variants, column counts and
// alignment, so two different briefs produce visibly different sites built
// from the same section library.
//
// The free-text `specifics` / `avoid` answers are received but NOT consumed
// by the stub (§1 framing rule). The validation pipeline (§4.4) still runs.
//
// Replace with a real backend call when the LLM lands; the GenerationContext
// → GeneratedPage contract stays identical. The real generator decides
// layout / theme itself — this design layer is the stub stand-in for it.
// =============================================================================

import type { GenerationContext, PrimaryIntent, Audience } from './generation-context';
import { getSectionDefinition } from './sections';
import { aboutSection } from './sections/about';
import { contactSection } from './sections/contact';
import { ctaSection } from './sections/cta';
import { faqSection } from './sections/faq';
import { featuresSection } from './sections/features';
import { gallerySection } from './sections/gallery';
import { heroSection } from './sections/hero';
import { offerSection } from './sections/offer';
import { reviewsSection } from './sections/reviews';
import { trustSection } from './sections/trust';
import { THEME_PRESETS, type SectionTheme } from './section-theme';
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
  'Choosing a layout…',
  'Writing copy…',
] as const;

export function randomDelayMs(): number {
  return Math.floor(Math.random() * 4000) + 4000;
}

// =============================================================================
// Design-variety layer
// =============================================================================

/** djb2 string hash → unsigned 32-bit. */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic design seed for a brief. Same brief → same site. */
function designSeed(ctx: GenerationContext): number {
  return hashString(
    `${ctx.pageType}|${ctx.primaryIntent.kind}|${ctx.audience}|${ctx.brand.industryCategory}`,
  );
}

/** A deterministic picker scoped to one generation. `salt` makes each
 *  decision independent, so layout choice and column choice don't move
 *  together. */
type Designer = {
  seed: number;
  pick: <T>(salt: string, arr: readonly T[]) => T;
  /** True with roughly `pct`% likelihood, deterministic per salt. */
  chance: (salt: string, pct: number) => boolean;
};

function makeDesigner(seed: number): Designer {
  const roll = (salt: string) => (seed ^ hashString(salt)) >>> 0;
  return {
    seed,
    pick: (salt, arr) => arr[roll(salt) % arr.length],
    chance: (salt, pct) => roll(salt) % 100 < pct,
  };
}

// -- band rhythm (light / dark surfaces) ------------------------------------

type Surface = 'base' | 'alt' | 'contrast';

function presetTheme(id: string): SectionTheme {
  const p = THEME_PRESETS.find((x) => x.id === id);
  return p ? { ...p.theme } : {};
}

const ALT_TINTS = ['#f3f4f6', '#f3f1ea', '#eef1f5', '#f4f2ee'] as const;
const DARK_PRESETS = ['midnight', 'ink'] as const;

/** Plan the page's light/dark rhythm. The hero is always a contrast band;
 *  the CTA is a contrast band most of the time (and forced to contrast when
 *  the hero is not, so every page has at least one striking surface); the
 *  middle sections alternate a plain base with a lightly-tinted alt. */
function planSurfaces(recipe: readonly SectionType[], dz: Designer): Surface[] {
  const last = recipe.length - 1;
  let altToggle = false;
  return recipe.map((type, i) => {
    if (i === 0) return 'contrast'; // hero
    if (i === last && type === 'cta') {
      return dz.chance('cta-surface', 60) ? 'contrast' : 'base';
    }
    altToggle = !altToggle;
    return altToggle ? 'alt' : 'base';
  });
}

function surfaceTheme(
  surface: Surface,
  darkPreset: string,
  altTint: string,
): SectionTheme {
  if (surface === 'contrast') return presetTheme(darkPreset);
  if (surface === 'alt') return { background: altTint };
  return {};
}

/** Everything a section filler needs to vary its layout + colours. */
type SectionDesign = {
  theme: SectionTheme;
  surface: Surface;
  pick: <T>(salt: string, arr: readonly T[]) => T;
  chance: (salt: string, pct: number) => boolean;
};

// =============================================================================
// Recipes — multiple well-formed section sequences per page type. The seed
// picks one, so the same page type produces different structures across
// briefs. Every recipe opens with a hero; content sections are ordered by
// good-page logic (lead → proof → detail → reassurance → close).
// =============================================================================

const HOME_RECIPES: readonly (readonly SectionType[])[] = [
  ['hero', 'features', 'trust', 'reviews', 'faq', 'cta'],
  ['hero', 'offer', 'features', 'reviews', 'cta'],
  ['hero', 'trust', 'about', 'features', 'gallery', 'reviews', 'cta'],
  ['hero', 'features', 'reviews', 'offer', 'faq', 'cta'],
];

const SERVICES_RECIPES: readonly (readonly SectionType[])[] = [
  ['hero', 'features', 'offer', 'trust', 'reviews', 'cta'],
  ['hero', 'offer', 'features', 'faq', 'cta'],
  ['hero', 'features', 'gallery', 'reviews', 'faq', 'cta'],
];

const ABOUT_RECIPES: readonly (readonly SectionType[])[] = [
  ['hero', 'about', 'trust', 'gallery', 'reviews', 'cta'],
  ['hero', 'about', 'features', 'reviews', 'cta'],
  ['hero', 'about', 'trust', 'reviews', 'faq', 'cta'],
];

const CONTACT_RECIPES: readonly (readonly SectionType[])[] = [
  ['hero', 'contact', 'faq'],
  ['hero', 'contact', 'trust'],
  ['hero', 'trust', 'contact'],
];

const GENERIC_RECIPES: readonly (readonly SectionType[])[] = [
  ['hero', 'offer', 'trust', 'reviews', 'faq', 'cta'],
  ['hero', 'features', 'reviews', 'offer', 'cta'],
  ['hero', 'offer', 'features', 'trust', 'cta'],
];

const RECIPE_SETS: Record<PageType, readonly (readonly SectionType[])[]> = {
  home: HOME_RECIPES,
  services: SERVICES_RECIPES,
  about: ABOUT_RECIPES,
  contact: CONTACT_RECIPES,
  generic: GENERIC_RECIPES,
};

/** The default (first) recipe for a page type — a stable structure for any
 *  caller that just wants a representative shape. */
export function recipeFor(pageType: PageType): readonly SectionType[] {
  return RECIPE_SETS[pageType][0];
}

function pickRecipe(ctx: GenerationContext, dz: Designer): readonly SectionType[] {
  return dz.pick('recipe', RECIPE_SETS[ctx.pageType]);
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

/** The stub generator. Async (with synthetic delay) so the call site can
 *  mount a progress card; the real backend implements the same shape. */
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
  const seed = designSeed(ctx);
  const dz = makeDesigner(seed);
  const voice = voiceFor(ctx.audience);

  const recipe = pickRecipe(ctx, dz);
  const surfaces = planSurfaces(recipe, dz);
  const darkPreset = dz.pick('dark-preset', DARK_PRESETS);
  const altTint = dz.pick('alt-tint', ALT_TINTS);

  const rawSections: GeneratedSection[] = recipe.map((type, i) => {
    const surface = surfaces[i];
    const design: SectionDesign = {
      surface,
      theme: surfaceTheme(surface, darkPreset, altTint),
      pick: (salt, arr) => dz.pick(`${type}.${i}.${salt}`, arr),
      chance: (salt, pct) => dz.chance(`${type}.${i}.${salt}`, pct),
    };
    return populateSection(type, ctx, voice, design);
  });

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
      droppedSections.push({ generationId, type: s.type, reason: 'unknown-type' });
      continue;
    }
    if (!def.allowedContainers.includes('page')) {
      droppedSections.push({ generationId, type: s.type, reason: 'invalid-container' });
      continue;
    }
    if (
      def.allowedPageTypes &&
      def.allowedPageTypes.length > 0 &&
      !def.allowedPageTypes.includes(ctx.pageType)
    ) {
      droppedSections.push({ generationId, type: s.type, reason: 'invalid-page-type' });
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
    kept.push({ ...s, data, populatedFields: Array.from(populated) });
  }
  return { sections: kept, fallbackLog, droppedSections };
}

function toSection(g: GeneratedSection): Section {
  return {
    id: `sec-${Math.random().toString(36).slice(2, 9)}`,
    type: g.type,
    enabled: true,
    data: g.data,
    ai: { draftedFields: g.populatedFields, lastRegenAt: nowIso() },
  };
}

// -- Section fillers --------------------------------------------------------

function populateSection(
  type: SectionType,
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const filler = SECTION_FILLERS[type];
  if (!filler) {
    return { type, enabled: true, data: {}, populatedFields: [] };
  }
  return filler(ctx, voice, d);
}

type FillerFn = (
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
) => GeneratedSection;

const SECTION_FILLERS: Partial<Record<SectionType, FillerFn>> = {
  hero: fillHero,
  offer: fillOffer,
  trust: fillTrust,
  features: fillFeatures,
  gallery: fillGallery,
  about: fillAbout,
  contact: fillContact,
  reviews: fillReviews,
  faq: fillFaq,
  cta: fillCta,
};

function fillHero(
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const businessNoun = nounFor(ctx);
  const layout = d.pick('layout', ['split', 'overlay'] as const);
  const headline = pick(voice, {
    'cold-ad-urgent': `${businessNoun} — sorted same day.`,
    'existing-calm': `Welcome back. Here for whatever you need.`,
    'search-plain': `${businessNoun} you can actually rely on.`,
  });
  const sub = pick(voice, {
    'cold-ad-urgent':
      'Local, licensed, on call. Fixed callout, written quote before we start, guaranteed work.',
    'existing-calm':
      'Same crew, same quality, same fair pricing. Book in below.',
    'search-plain':
      "Read what we do, see our pricing, and book when you're ready.",
  });
  const wantsForm =
    (ctx.primaryIntent.kind === 'quote' || ctx.primaryIntent.kind === 'book') &&
    d.chance('form', 38);
  return {
    type: 'hero',
    enabled: true,
    data: {
      ...heroSection.defaultData(),
      theme: d.theme,
      layout,
      contentAlign: layout === 'overlay' ? d.pick('align', ['left', 'center'] as const) : 'left',
      imageSide: d.pick('side', ['left', 'right'] as const),
      headlineSize: d.pick('size', ['l', 'xl'] as const),
      formMode: wantsForm ? 'lead' : 'none',
      eyebrow: ctx.brand.industryCategory.toUpperCase(),
      headline,
      headlineAccent: '',
      sub,
      ctaPrimaryLabel: intentCtaLabel(ctx.primaryIntent),
      ctaPrimaryHref: intentHref(ctx.primaryIntent),
      ctaSecondaryLabel: 'Call now',
      ctaSecondaryHref: 'tel:0400000000',
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

function fillOffer(
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const asStack = d.chance('mode', 45);
  const title = pick(voice, {
    'cold-ad-urgent': asStack ? 'Everything we do — built to get you results.' : 'First callout — fixed price, no surprises.',
    'existing-calm': asStack ? 'The complete service, end to end.' : 'The standard — what most jobs cost.',
    'search-plain': asStack ? 'What is included, in plain terms.' : "What you'll pay for a typical job.",
  });
  const inclusions = [
    'Licensed tradesperson on-site',
    'Diagnosis + written quote before work starts',
    '12-month workmanship guarantee',
    'No callout surcharge after hours',
  ].map((text) => ({ id: `inc-${rid()}`, text }));
  return {
    type: 'offer',
    enabled: true,
    data: {
      ...offerSection.defaultData(),
      theme: d.theme,
      layout: asStack ? 'stack' : 'card',
      stackStyle: d.pick('stackStyle', ['grid', 'list'] as const),
      columns: d.pick('cols', [2, 3] as const),
      showNumbers: d.chance('numbers', 55),
      headerAlign: 'center',
      tag: 'OFFER',
      title,
      priceLabel: '$99',
      priceCaption: 'Fixed callout',
      inclusions,
      scarcityCopy: 'Same-day slots fill by mid-morning.',
      ctaLabel: intentCtaLabel(ctx.primaryIntent),
      ctaHref: intentHref(ctx.primaryIntent),
    },
    populatedFields: [
      'tag',
      'title',
      'priceLabel',
      'priceCaption',
      'inclusions',
      'scarcityCopy',
      'ctaLabel',
      'ctaHref',
    ],
  };
}

function fillTrust(
  ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = trustSection.defaultData();
  return {
    type: 'trust',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      display: d.pick('display', ['stats', 'logos'] as const),
      headerAlign: 'center',
      showDividers: d.chance('dividers', 70),
      headline:
        ctx.audience === 'cold-ad'
          ? 'Trusted by hundreds of local customers.'
          : base.headline,
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'items'],
  };
}

function fillFeatures(
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = featuresSection.defaultData();
  const headline = pick(voice, {
    'cold-ad-urgent': 'Everything we do, done right.',
    'existing-calm': 'The services you already trust us with.',
    'search-plain': 'Our services',
  });
  return {
    type: 'features',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      layout: d.pick('layout', ['cards', 'plain'] as const),
      mediaStyle: 'icon',
      iconStyle: d.pick('iconStyle', ['soft', 'solid', 'bare'] as const),
      columns: d.pick('cols', [3, 4] as const),
      headerAlign: d.pick('align', ['left', 'center'] as const),
      showDividers: d.chance('dividers', 50),
      eyebrow: 'WHAT WE DO',
      headline,
      sub: ctx.brand.audienceLine || base.sub,
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'items'],
  };
}

function fillGallery(
  _ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = gallerySection.defaultData();
  return {
    type: 'gallery',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      layout: d.pick('layout', ['grid', 'masonry'] as const),
      columns: d.pick('cols', [3, 4] as const),
      aspect: d.pick('aspect', ['landscape', 'square', 'portrait'] as const),
      headerAlign: d.pick('align', ['left', 'center'] as const),
    },
    populatedFields: ['eyebrow', 'headline', 'sub'],
  };
}

function fillAbout(
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = aboutSection.defaultData();
  const headline = pick(voice, {
    'cold-ad-urgent': 'Local experts. Real results.',
    'existing-calm': 'The team you already know.',
    'search-plain': 'About us',
  });
  return {
    type: 'about',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      imageSide: d.pick('side', ['left', 'right'] as const),
      extra: d.pick('extra', ['features', 'stats'] as const),
      overlay: d.pick('overlay', ['stat', 'none'] as const),
      eyebrow: 'WHY CHOOSE US',
      headline,
      headlineAccent: '',
      sub: ctx.brand.audienceLine || base.sub,
    },
    populatedFields: ['eyebrow', 'headline', 'sub'],
  };
}

function fillContact(
  _ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = contactSection.defaultData();
  return {
    type: 'contact',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      layout: d.pick('layout', ['details', 'cards', 'map', 'stacked'] as const),
      headerAlign: d.pick('align', ['left', 'center'] as const),
    },
    populatedFields: ['eyebrow', 'headline', 'sub'],
  };
}

function fillReviews(
  _ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = reviewsSection.defaultData();
  const layout = d.pick('layout', ['grid', 'spotlight'] as const);
  return {
    type: 'reviews',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      layout,
      columns: 3,
      headerAlign: 'center',
      nav: d.pick('nav', ['none', 'dots'] as const),
      showRatingSummary: d.chance('rating', 45),
      items: [
        {
          id: `rev-${rid()}`,
          quote: 'Out in 40 min, fixed and gone in another 30. Honest pricing.',
          authorName: 'Sarah K.',
          authorRole: 'Homeowner',
          avatarUrl: '',
          rating: 5,
        },
        {
          id: `rev-${rid()}`,
          quote: 'Quote was the final invoice — no surprises. Rare these days.',
          authorName: 'Mark R.',
          authorRole: 'Homeowner',
          avatarUrl: '',
          rating: 5,
        },
        {
          id: `rev-${rid()}`,
          quote: 'Booked on a Saturday night, came Sunday morning. Lifesavers.',
          authorName: 'Jules T.',
          authorRole: 'Business owner',
          avatarUrl: '',
          rating: 5,
        },
      ],
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'items'],
  };
}

function fillFaq(
  ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  return {
    type: 'faq',
    enabled: true,
    data: {
      ...faqSection.defaultData(),
      theme: d.theme,
      layout: d.pick('layout', ['centered', 'grid', 'sidebar'] as const),
      columns: 2,
      footer: d.pick('footer', ['link', 'card', 'signals'] as const),
      headline: 'Common questions',
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
            "$99 fixed — that's diagnosis + a written quote. No surprises before we start work.",
        },
        {
          id: `faq-${rid()}`,
          question: 'Are you licensed and insured?',
          answer: `Yes — fully licensed and insured. ${ctx.brand.industryCategory} only.`,
        },
      ],
    },
    populatedFields: ['headline', 'items'],
  };
}

function fillCta(
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const headline = pick(voice, {
    'cold-ad-urgent': `${nounFor(ctx)} at your door this hour.`,
    'existing-calm': 'Book the next one when it suits you.',
    'search-plain': "When you're ready, book in below.",
  });
  // The split / background layouts need an image to look complete; a fresh
  // generation has none, so stick to the self-contained layouts.
  const layout = d.pick('layout', ['centered', 'dual'] as const);
  return {
    type: 'cta',
    enabled: true,
    data: {
      ...ctaSection.defaultData(),
      theme: d.theme,
      layout,
      align: d.pick('align', ['left', 'center'] as const),
      showSignals: layout !== 'dual' && d.chance('signals', 65),
      eyebrow: 'READY?',
      headline,
      sub: 'One call, fixed callout, written quote on arrival.',
      primaryLabel: intentCtaLabel(ctx.primaryIntent),
      primaryHref: intentHref(ctx.primaryIntent),
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'primaryLabel', 'primaryHref'],
  };
}

// -- Per-section copy helpers -----------------------------------------------

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
