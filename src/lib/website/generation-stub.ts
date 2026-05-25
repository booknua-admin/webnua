// =============================================================================
// generation-stub — the form-to-page generator (stub).
//
// Synthetic delay 4–8s. Output is deterministic on the brief, and carries a
// design-variety layer (recipe choice, light/dark band rhythm, per-section
// layout variants). When the create-client flow supplies a `business` block
// the fillers weave real details — business name, offer, services, contact —
// into the copy instead of generic templated text.
//
// Replace with a real backend call when the LLM lands; the GenerationContext
// → GeneratedPage contract stays identical.
// =============================================================================

import type {
  Audience,
  BusinessDetails,
  GenerationContext,
  PrimaryIntent,
} from './generation-context';
import {
  injectStockImages,
  reconcileColumns,
  resolveIndustryString,
  resolveStockImage,
  stripHallucinatedImages,
  validateEnums,
} from './generation-validation';
import { getSectionMeta } from './sections/registry-meta';
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
import {
  resolveIndustryTemplate,
  type IndustryTemplate,
} from './industry-templates';
import type {
  Page,
  PageSEO,
  PageType,
  Section,
  SectionAIMeta,
  SectionType,
} from './types';

export type GeneratedSection = {
  type: SectionType;
  enabled: true;
  data: Record<string, unknown>;
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

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function designSeed(ctx: GenerationContext): number {
  return hashString(
    `${ctx.pageType}|${ctx.primaryIntent.kind}|${ctx.audience}|${ctx.brand.industryCategory}|${ctx.business?.name ?? ''}`,
  );
}

type Designer = {
  seed: number;
  pick: <T>(salt: string, arr: readonly T[]) => T;
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

type Surface = 'base' | 'alt' | 'contrast';

function presetTheme(id: string): SectionTheme {
  const p = THEME_PRESETS.find((x) => x.id === id);
  return p ? { ...p.theme } : {};
}

const ALT_TINTS = ['#f3f4f6', '#f3f1ea', '#eef1f5', '#f4f2ee'] as const;
const DARK_PRESETS = ['midnight', 'ink'] as const;

function planSurfaces(recipe: readonly SectionType[], dz: Designer): Surface[] {
  const last = recipe.length - 1;
  let altToggle = false;
  return recipe.map((type, i) => {
    if (i === 0) return 'contrast';
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

type SectionDesign = {
  theme: SectionTheme;
  surface: Surface;
  pick: <T>(salt: string, arr: readonly T[]) => T;
  chance: (salt: string, pct: number) => boolean;
};

// =============================================================================
// Recipes
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

export function recipeFor(pageType: PageType): readonly SectionType[] {
  return RECIPE_SETS[pageType][0];
}

function pickRecipe(ctx: GenerationContext, dz: Designer): readonly SectionType[] {
  return dz.pick('recipe', RECIPE_SETS[ctx.pageType]);
}

// -- Voice variants ---------------------------------------------------------

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

export async function generatePageStub(
  ctx: GenerationContext,
  options?: { signal?: AbortSignal; instantForDev?: boolean },
): Promise<GenerationResult> {
  if (!options?.instantForDev) {
    await delay(randomDelayMs(), options?.signal);
  }
  return generateSync(ctx);
}

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

  return assembleResult(ctx, rawSections, generationId);
}

// -- Result assembly --------------------------------------------------------

/** Turn raw GeneratedSections — from the deterministic recipe OR a real LLM
 *  response — into a validated GenerationResult. Runs the design-doc §4.4
 *  validation pipeline, then assembles the Page. `overrides` lets the live
 *  generator (generate-live.ts) supply the model's own title / slug / seo. */
export function assembleResult(
  ctx: GenerationContext,
  rawSections: GeneratedSection[],
  generationId: string,
  overrides?: { title?: string; slug?: string; seo?: PageSEO },
): GenerationResult {
  const { sections, fallbackLog, droppedSections } = runValidationPipeline(
    rawSections,
    ctx,
    generationId,
  );

  const title = overrides?.title?.trim() || inferPageTitle(ctx);
  const slug = overrides?.slug?.trim() || inferSlug(title);
  const page: Page = {
    // A unique id per page — NOT the generationId. A site-generation run
    // shares one generationId across all its pages (for generation_log
    // grouping); reusing it as the page id collided every page of a site.
    id: `page-${rid()}`,
    websiteId: '__pending__',
    slug,
    title,
    type: ctx.pageType,
    sections: sections.map(toSection),
    seo: overrides?.seo ?? defaultSeo(title, ctx),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return { generationId, page, fallbackLog, droppedSections };
}

// -- Validation pipeline ----------------------------------------------------

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
  const industry = resolveIndustryString({
    brand: { industryCategory: ctx.brand.industryCategory },
  });
  // C1: per-slot image-diversity seed. The business name is the stable
  // per-customer identifier the deterministic hash uses to pick a starting
  // gallery offset for each slot — so two clients on the same industry get
  // different photo combinations, but the SAME client reliably picks the
  // same photo for the same slot across re-runs (no churn). Absent name
  // (some dev-flow paths) falls back to the pre-C1 fixed-position
  // behaviour inside the helper.
  const slugSeed = ctx.business?.name?.trim() || undefined;

  for (const s of sections) {
    // Server-safe metadata: the section .tsx modules are 'use client', so
    // we can't reach their full defineSection() object from the server
    // bundle. SectionMeta carries the keys + container constraints; the
    // editor's withDefaults() fills missing fields at render time.
    const def = getSectionMeta(s.type);
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
    let data: Record<string, unknown> = { ...s.data };
    const populated = new Set(s.populatedFields);

    // Pass A — theme-discard guard: the model is told not to emit a `theme`
    // field, but it sometimes still does — and a per-section theme can
    // fight the brand defaults (text-on-bg contrast bugs). Strip it before
    // the section lands in the editor so brand defaults apply uniformly.
    // Logged as a fallback (reason='invalid') so /api/generate-site's
    // generation_log writer can track whether the model is still attempting
    // it after the prompt change.
    if ('theme' in data) {
      const modelValue = data.theme;
      delete data.theme;
      populated.delete('theme');
      fallbackLog.push({
        generationId,
        sectionType: s.type,
        fieldName: 'theme',
        reason: 'invalid',
        modelValue,
      });
    }

    // Pass B — enum validation. The model is told the catalog of allowed
    // values per variant key in `SECTION_SHAPE_CATALOG`; sometimes it
    // hallucinates outside that set (audit found `offer.layout='single'`
    // surviving in 12.5% of offers). Substitute with the catalog's first
    // listed value AND log so we can track which keys drift.
    const enumPass = validateEnums(s.type, data);
    data = enumPass.data;
    for (const fb of enumPass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
      // The field is now valid (substituted) — keep it in populatedFields.
    }

    // Pass C — hallucinated image-path stripping. The model occasionally
    // emits `/images/work-extension-1.jpg`-style paths that 404 in prod
    // (audit: 12.5% of heroes, 14.3% of gallery items, 18.3% of about).
    // Clear them so Pass D can refill from the industry stock kit.
    const stripPass = stripHallucinatedImages(s.type, data);
    data = stripPass.data;
    for (const fb of stripPass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
      // Field name in the fb may be array-indexed (`items[3].imageUrl`);
      // we don't try to maintain populatedFields for array elements.
    }

    // Pass D — stock-image injection. Fill any image slot that's now empty
    // (AI omitted OR Pass C cleared) from the industry kit. Logged as
    // `missing` with `modelValue=<the injected URL>` so the audit signal
    // distinguishes "we injected" from "we left empty".
    const injectPass = injectStockImages(s.type, data, industry, {
      slug: slugSeed,
      surface: 'site',
    });
    data = injectPass.data;
    for (const fb of injectPass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
      // The field is now populated; mark it on the populated set when the
      // field name has no array index (scalar slots only).
      if (!fb.fieldName.includes('[')) {
        populated.add(fb.fieldName);
      }
    }

    // Pass E — items/columns reconciliation. When `items.length < columns`,
    // clamp columns down so the renderer doesn't pad with empty cards.
    data = reconcileColumns(s.type, data);

    // Pass F — missing-field reporting. The §4.4 contract; runs LAST so
    // injected/substituted fields aren't double-flagged as missing.
    for (const key of def.defaultDataKeys) {
      const value = data[key];
      if (value === undefined || value === null) {
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
  const ai: SectionAIMeta = {
    draftedFields: g.populatedFields,
    lastRegenAt: nowIso(),
  };
  // Reviews are AI-invented testimonials — snapshot them verbatim so the
  // editor nudge + the pre-publish preflight can tell whether the operator
  // has since replaced them with real customer reviews (B16; see
  // lib/website/placeholder-testimonials.ts).
  if (g.type === 'reviews' && Array.isArray(g.data.items)) {
    ai.placeholderSnapshot = {
      reviews: (g.data.items as Array<Record<string, unknown>>).map((it) => ({
        quote: typeof it.quote === 'string' ? it.quote : '',
        authorName: typeof it.authorName === 'string' ? it.authorName : '',
        authorRole: typeof it.authorRole === 'string' ? it.authorRole : '',
      })),
    };
  }
  return {
    id: `sec-${Math.random().toString(36).slice(2, 9)}`,
    type: g.type,
    enabled: true,
    data: g.data,
    ai,
  };
}

// =============================================================================
// Brief-aware copy helpers
// =============================================================================

/** Service entries derived from the captured services list (icon + title +
 *  description), or [] when the brief carried none. */
function serviceEntries(
  ctx: GenerationContext,
): { icon: string; title: string; description: string }[] {
  const services = (ctx.business?.services ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
  // Brief-supplied services win; if empty, fall back to the industry
  // template's defaults so the fallback path produces credible service
  // tiles for the resolved trade instead of dropping them entirely.
  const source =
    services.length > 0
      ? services
      : [...resolveIndustryTemplate(ctx.brand.industryCategory).defaultServices];
  return source.map((name) => ({
    icon: iconForService(name),
    title: name,
    description: `Professional ${name.toLowerCase()} — done right the first time, by licensed local pros.`,
  }));
}

const SERVICE_ICON_RULES: readonly [RegExp, string][] = [
  [/plumb|drain|pipe|leak|tap|hot ?water/, 'droplet'],
  [/electr|wir|power|light|switchboard|ev charg/, 'zap'],
  [/heat|hvac|air ?con|cool|furnace|ducted/, 'snowflake'],
  [/fan|ventil/, 'fan'],
  [/clean|wash|tidy/, 'spray-can'],
  [/paint|render/, 'paint-roller'],
  [/roof|gutter/, 'house'],
  [/garden|landscap|lawn|tree|mow|hedge/, 'leaf'],
  [/lock|security|key|alarm/, 'lock'],
  [/build|construct|renov|carpentr|extension|deck/, 'hammer'],
  [/inspect|safety|test|compliance|report/, 'shield-check'],
  [/repair|fix|maintain|service|tune/, 'wrench'],
  [/install|fit|upgrade/, 'drill'],
  [/emergency|24|urgent|same.?day/, 'clock'],
  [/move|removal|transport|deliver/, 'truck'],
  [/quote|estimate|consult/, 'message'],
];

function iconForService(name: string): string {
  const n = name.toLowerCase();
  for (const [re, icon] of SERVICE_ICON_RULES) {
    if (re.test(n)) return icon;
  }
  return 'check';
}

/** A short value-prop headline built from the brief. Industry-aware: the
 *  resolved template's urgency mode shapes the framing so callout trades
 *  lead with response time, scheduled trades lead with reliability, and
 *  project trades lead with craft. */
function valueHeadline(ctx: GenerationContext, voice: VoiceVariant): string {
  const industry = ctx.brand.industryCategory || 'Local service';
  const area = ctx.business?.serviceArea;
  const template = resolveIndustryTemplate(ctx.brand.industryCategory);
  // Existing-customer voice stays personal regardless of industry.
  if (voice === 'existing-calm') {
    return ctx.business?.name
      ? `Welcome back to ${ctx.business.name}.`
      : 'Welcome back.';
  }
  // Urgency-mode-shaped framing.
  switch (template.urgencyMode) {
    case 'emergency-callout':
      return voice === 'cold-ad-urgent'
        ? `${capitalize(industry)} — on the road, fixed quote, today.`
        : area
        ? `Local ${industry.toLowerCase()} in ${area} — on call, properly licensed.`
        : `Local ${industry.toLowerCase()} — on call, properly licensed.`;
    case 'scheduled':
      return voice === 'cold-ad-urgent'
        ? `${capitalize(industry)} that actually turns up.`
        : area
        ? `Reliable ${industry.toLowerCase()} across ${area}.`
        : `Reliable ${industry.toLowerCase()} you can plan around.`;
    case 'project':
      return voice === 'cold-ad-urgent'
        ? `${capitalize(industry)} done properly — on time, on budget.`
        : area
        ? `${capitalize(industry)} across ${area} — quoted honestly, finished tidily.`
        : `${capitalize(industry)} done properly, quoted honestly.`;
    case 'mixed':
      return voice === 'cold-ad-urgent'
        ? `${capitalize(industry)} — sorted, same day where it matters.`
        : area
        ? `${capitalize(industry)} in ${area}, done properly.`
        : `${capitalize(industry)} you can rely on.`;
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// =============================================================================
// Section fillers
// =============================================================================

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
  const template = resolveIndustryTemplate(ctx.brand.industryCategory);
  const layout = d.pick('layout', ['split', 'overlay'] as const);
  const headline = valueHeadline(ctx, voice);
  const offer = ctx.business?.offer?.trim();
  // Fallback chain: real offer copy → industry-template offer framing →
  // brand audience line → final generic. The template framing is the new
  // middle layer — replaces the pre-industry generic with copy that reads
  // for THIS trade. Brand audience line stays as last-resort customisation.
  const sub =
    offer || template.offerFraming || ctx.brand.audienceLine ||
    'Local, licensed and on call — fixed callout, written quote before we start.';
  const phone = ctx.business?.phone?.trim();
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
      eyebrow: (ctx.brand.industryCategory || template.displayName).toUpperCase(),
      headline,
      headlineAccent: '',
      sub,
      // Industry-template hero image — credible default for the trade.
      // Operator brand photography replaces this once uploaded. Shared
      // resolver (resolveStockImage) is the single source of stock URLs
      // for both this deterministic path AND the live Bundle B injection
      // path, so the two routes can never drift.
      heroImageUrl: resolveStockImage(
        ctx.brand.industryCategory,
        'hero',
        'heroImageUrl',
        { slug: ctx.business?.name?.trim() || undefined, surface: 'site' },
      ),
      ctaPrimaryLabel: industryCtaPrimary(ctx, template),
      ctaPrimaryHref: intentHref(ctx.primaryIntent),
      ctaSecondaryLabel: phone ? `Call ${phone}` : template.ctaSecondary,
      ctaSecondaryHref: phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : 'tel:0400000000',
    },
    populatedFields: [
      'eyebrow',
      'headline',
      'sub',
      'heroImageUrl',
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
  // Generated offers run as a value stack — no invented price.
  const services = serviceEntries(ctx);
  const items =
    services.length > 0
      ? services.map((s) => ({ id: `val-${rid()}`, ...s }))
      : offerSection.defaultData().items;
  const title = pick(voice, {
    'cold-ad-urgent': 'Everything you get — no surprises.',
    'existing-calm': 'The complete service, end to end.',
    'search-plain': 'What is included.',
  });
  return {
    type: 'offer',
    enabled: true,
    data: {
      ...offerSection.defaultData(),
      theme: d.theme,
      layout: 'stack',
      stackStyle: d.pick('stackStyle', ['grid', 'list'] as const),
      columns: d.pick('cols', [2, 3] as const),
      showNumbers: d.chance('numbers', 55),
      headerAlign: 'center',
      tag: 'WHAT YOU GET',
      title,
      titleAccent: '',
      sub: ctx.business?.offer?.trim() || offerSection.defaultData().sub,
      items,
      ctaLabel: intentCtaLabel(ctx.primaryIntent),
      ctaHref: intentHref(ctx.primaryIntent),
    },
    populatedFields: ['tag', 'title', 'sub', 'items', 'ctaLabel', 'ctaHref'],
  };
}

function fillTrust(
  ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = trustSection.defaultData();
  const template = resolveIndustryTemplate(ctx.brand.industryCategory);
  const area = ctx.business?.serviceArea;
  // Industry-specific badges instead of the generic seed set. The model on
  // the Claude path may set its own; the deterministic fallback uses the
  // first four template trust signals so an electrician's preview shows
  // "RECI registered" and a plumber's shows "Gas Safe registered" instead
  // of identical "Fully licensed / Insured / Background checked".
  const industryBadges = template.trustSignals.slice(0, 4).map((label) => ({
    id: `badge-${rid()}`,
    icon: 'shield-check',
    label,
  }));
  return {
    type: 'trust',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      display: d.pick('display', ['stats', 'logos'] as const),
      headerAlign: 'center',
      showDividers: d.chance('dividers', 70),
      headline: area
        ? `Trusted across ${area}.`
        : 'Local service, proven results.',
      sub: ctx.brand.audienceLine || base.sub,
      // Industry-specific badges replace the generic seed set when we have
      // a real template (>= 2 signals); otherwise keep base.badges so the
      // generic-industry path still renders.
      badges: industryBadges.length >= 2 ? industryBadges : base.badges,
      showBadges: industryBadges.length >= 2,
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'items', 'badges'],
  };
}

function fillFeatures(
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = featuresSection.defaultData();
  const services = serviceEntries(ctx);
  const items =
    services.length > 0
      ? services.map((s) => ({
          id: `feat-${rid()}`,
          icon: s.icon,
          imageUrl: '',
          title: s.title,
          description: s.description,
          linkLabel: 'Learn more',
          linkHref: '#',
        }))
      : base.items;
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
      items,
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'items'],
  };
}

function fillGallery(
  ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = gallerySection.defaultData();
  // Overlay the industry stock URLs onto the base item set so the gallery
  // doesn't render four broken-image tiles in the fallback path. Uses the
  // shared resolveStockImage helper so this path and the live-AI Bundle B
  // injection share the same URL source.
  type GalleryItem = (typeof base.items)[number];
  // The base.items array may be empty (post-Bundle-A defaults sweep);
  // grow a minimum set of 3 placeholder items so the deterministic
  // fallback still renders a visible gallery.
  const baseItems: GalleryItem[] =
    base.items.length > 0
      ? base.items
      : [0, 1, 2].map(() => ({
          id: `gal-${rid()}`,
          imageUrl: '',
          caption: '',
          category: '',
        }));
  const slugSeed = ctx.business?.name?.trim() || undefined;
  const items: GalleryItem[] = baseItems.map((item, i) => {
    const url = resolveStockImage(
      ctx.brand.industryCategory,
      'gallery',
      'items[i].imageUrl',
      { slug: slugSeed, surface: 'site', index: i },
    );
    return url ? { ...item, imageUrl: url } : item;
  });
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
      headline: 'Our recent work',
      items,
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'items'],
  };
}

function fillAbout(
  ctx: GenerationContext,
  voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = aboutSection.defaultData();
  const name = ctx.business?.name;
  const area = ctx.business?.serviceArea;
  const headline = pick(voice, {
    'cold-ad-urgent': 'Local experts. Real results.',
    'existing-calm': name ? `The team behind ${name}.` : 'The team you know.',
    'search-plain': name ? `About ${name}` : 'About us',
  });
  const sub =
    ctx.business?.offer?.trim() ||
    (area
      ? `A locally owned business serving ${area} — built on honest pricing and work that lasts.`
      : base.sub);
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
      sub,
    },
    populatedFields: ['eyebrow', 'headline', 'sub'],
  };
}

function fillContact(
  ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = contactSection.defaultData();
  const b = ctx.business;
  const items = b
    ? [
        { id: `con-${rid()}`, icon: 'phone', label: 'Phone', value: b.phone || '—', sub: 'Call us anytime' },
        { id: `con-${rid()}`, icon: 'mail', label: 'Email', value: b.email || '—', sub: 'We reply within 24 hours' },
        { id: `con-${rid()}`, icon: 'map-pin', label: 'Service area', value: b.serviceArea || '—', sub: 'Where we work' },
        { id: `con-${rid()}`, icon: 'clock', label: 'Hours', value: 'Mon–Sat', sub: 'After-hours by arrangement' },
      ]
    : base.items;
  return {
    type: 'contact',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      layout: d.pick('layout', ['details', 'cards', 'map', 'stacked'] as const),
      headerAlign: d.pick('align', ['left', 'center'] as const),
      headline: b?.name ? `Get in touch with ${b.name}.` : base.headline,
      items,
    },
    populatedFields: ['eyebrow', 'headline', 'sub', 'items'],
  };
}

function fillReviews(
  ctx: GenerationContext,
  _voice: VoiceVariant,
  d: SectionDesign,
): GeneratedSection {
  const base = reviewsSection.defaultData();
  return {
    type: 'reviews',
    enabled: true,
    data: {
      ...base,
      theme: d.theme,
      layout: d.pick('layout', ['grid', 'spotlight'] as const),
      columns: 3,
      headerAlign: 'center',
      nav: d.pick('nav', ['none', 'dots'] as const),
      showRatingSummary: d.chance('rating', 45),
      items: [
        {
          id: `rev-${rid()}`,
          quote: 'Fast, professional and fairly priced. The quote was the final invoice.',
          authorName: 'Sarah K.',
          authorRole: 'Homeowner',
          avatarUrl: '',
          rating: 5,
        },
        {
          id: `rev-${rid()}`,
          quote: 'Showed up on time, explained everything, cleaned up after. Highly recommend.',
          authorName: 'Mark R.',
          authorRole: 'Homeowner',
          avatarUrl: '',
          rating: 5,
        },
        {
          id: `rev-${rid()}`,
          quote: 'Booked on short notice and they sorted it the same day. Lifesavers.',
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
  const area = ctx.business?.serviceArea || 'the local area';
  const industry = ctx.brand.industryCategory || 'work';
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
          question: 'What areas do you cover?',
          answer: `We service ${area} and the surrounding suburbs. Not sure if you're covered? Give us a call.`,
        },
        {
          id: `faq-${rid()}`,
          question: 'How do I get a quote?',
          answer:
            'Send a message or call us — we’ll give you a clear, written quote, usually the same day.',
        },
        {
          id: `faq-${rid()}`,
          question: 'Are you licensed and insured?',
          answer: `Yes — fully licensed and insured for all ${industry}. Your property is in safe hands.`,
        },
        {
          id: `faq-${rid()}`,
          question: 'Do you guarantee your work?',
          answer:
            'Every job is backed by our workmanship guarantee — if something isn’t right, we make it right.',
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
  const template = resolveIndustryTemplate(ctx.brand.industryCategory);
  const name = ctx.business?.name;
  // Headline framing matches the trade's urgency mode — emergency callout
  // trades push "today" urgency; scheduled trades push "easy to book";
  // project trades push "no rush, well planned".
  const urgentClose: Record<typeof template.urgencyMode, string> = {
    'emergency-callout': 'On the road today — call or book online.',
    scheduled: 'Easy to book. Easy to reschedule. We turn up.',
    project: 'Free consultation, honest quote, finished tidily.',
    mixed: 'One call, a fixed quote, and work that’s guaranteed.',
  };
  const calmClose = name
    ? `Ready when you are, ${name}.`
    : 'Book the next one when it suits you.';
  const headline = pick(voice, {
    'cold-ad-urgent': urgentClose[template.urgencyMode],
    'existing-calm': calmClose,
    'search-plain': "When you're ready, get in touch.",
  });
  const layout = d.pick('layout', ['centered', 'dual'] as const);
  const phone = ctx.business?.phone?.trim();
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
      sub:
        ctx.business?.offer?.trim() || template.offerFraming ||
        'One call, a fixed quote, and work that’s guaranteed.',
      primaryLabel: industryCtaPrimary(ctx, template),
      primaryHref: intentHref(ctx.primaryIntent),
      secondaryLabel: phone ? `Call ${phone}` : template.ctaSecondary,
      secondaryHref: phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '/contact',
    },
    populatedFields: [
      'eyebrow',
      'headline',
      'sub',
      'primaryLabel',
      'primaryHref',
      'secondaryLabel',
      'secondaryHref',
    ],
  };
}

// =============================================================================
// Header / footer fillers — website-level singletons, used by the site
// generator (not part of a page recipe).
// =============================================================================

function genSection(type: SectionType, data: Record<string, unknown>): Section {
  return {
    id: `sec-${Math.random().toString(36).slice(2, 9)}`,
    type,
    enabled: true,
    data,
    ai: { draftedFields: Object.keys(data), lastRegenAt: nowIso() },
  };
}

export function fillHeaderSection(ctx: GenerationContext): Section {
  const b = ctx.business;
  // Read the static defaults from registry-meta — section modules are
  // 'use client' and become client-reference stubs in the server bundle,
  // so headerSection.defaultData() would crash on the /api/generate-site
  // path. See the parked decision "Section metadata server/client boundary".
  const defaults = getSectionMeta('header')?.defaultDataValues ?? {};
  return genSection('header', {
    ...defaults,
    layout: 'logo-left',
    logoText: b?.name || 'Your Business',
    logoTagline: capitalize(ctx.brand.industryCategory || ''),
    logoImageUrl: ctx.brand.logoUrl ?? '',
    showCta: true,
    ctaLabel: intentCtaLabel(ctx.primaryIntent),
    ctaHref: intentHref(ctx.primaryIntent),
    ctaStyle: 'solid',
  });
}

export function fillFooterSection(ctx: GenerationContext): Section {
  const b = ctx.business;
  const year = new Date().getFullYear();
  const defaults = getSectionMeta('footer')?.defaultDataValues ?? {};
  return genSection('footer', {
    ...defaults,
    logoText: b?.name || 'Your Business',
    logoImageUrl: ctx.brand.logoUrl ?? '',
    brandLine: ctx.brand.audienceLine || `Trusted ${ctx.brand.industryCategory}.`,
    showContact: true,
    contactHeading: 'Contact us',
    contactAddress: b?.serviceArea || '',
    contactPhone: b?.phone || '',
    contactEmail: b?.email || '',
    rightBlock: 'newsletter',
    legalText: `© ${year} ${b?.name || 'Your Business'}. All rights reserved.`,
  });
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

/** Industry-aware primary CTA label. The brief's `primaryIntent` wins when
 *  the user expressed a clear preference (`call` / `quote` / `signup` /
 *  `read` / `other`). `book` is ambiguous across trades — a callout trade
 *  reads "Call now" naturally, a project trade reads "Get a quote" — so for
 *  `book` we defer to the industry template. */
function industryCtaPrimary(
  ctx: GenerationContext,
  template: IndustryTemplate,
): string {
  if (ctx.primaryIntent.kind === 'book') {
    return template.ctaPrimary;
  }
  return intentCtaLabel(ctx.primaryIntent);
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
  const name = ctx.business?.name || ctx.brand.industryCategory;
  return {
    title: `${title} — ${name}`,
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
