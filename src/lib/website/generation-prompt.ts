// =============================================================================
// generation-prompt — pure prompt-block construction from a GenerationContext.
//
// Why this lives in its own file: this is the part of Session 6 that
// graduates to the real backend when the LLM lands. Keeping it side-effect
// free (no I/O, no React) makes it testable in isolation and rendered
// in the /dev/generation-preview surface (design doc §6a).
// =============================================================================

import type { BrandObject, PageType, SectionType, VoiceTone } from './types';
import type { GenerationContext, PrimaryIntent } from './generation-context';
import { describeAudience, describeIntent, describePageType } from './generation-context';
import { SECTION_REGISTRY_META, type SectionMeta } from './sections/registry-meta';
import {
  renderIndustryPromptBlock,
  resolveIndustryTemplate,
  type IndustryTemplate,
} from './industry-templates';

export type PromptBlock = {
  id:
    | 'system'
    | 'brand'
    | 'industry'
    | 'industry-knowledge'
    | 'page-questions'
    | 'existing-pages'
    | 'registry-catalog'
    | 'example';
  heading: string;
  body: string;
};

/** Compose all five prompt blocks for a generation. Empty optional answers
 *  cause their lines to be omitted (we send nothing, not "null"). The
 *  existing-pages block is omitted entirely when the website is new. */
export function buildPromptBlocks(ctx: GenerationContext): PromptBlock[] {
  const blocks: PromptBlock[] = [
    {
      id: 'system',
      heading: 'System preamble',
      body: buildSystemPreamble(),
    },
    {
      id: 'brand',
      heading: 'Brand context',
      body: buildBrandBlock(ctx.brand),
    },
    {
      id: 'industry',
      heading: 'Industry context',
      body: buildIndustryBlock(ctx.brand),
    },
  ];
  // Conversational-onboarding industry knowledge — appended AFTER the
  // template-based industry block so the AI-resolved customer pain +
  // desired outcomes + voice arrive as supplemental, not replacement,
  // signals. For unmapped industries the template block is the generic
  // fallback and this block carries the real shape; for mapped trades
  // both blocks reinforce each other.
  if (ctx.industryKnowledge) {
    blocks.push({
      id: 'industry-knowledge',
      heading: 'Industry knowledge (resolved live for this business)',
      body: buildIndustryKnowledgeBlock(ctx.industryKnowledge),
    });
  }
  blocks.push({
    id: 'page-questions',
    heading: 'Page questions',
    body: buildQuestionsBlock(ctx),
  });
  if (ctx.existingPages.length > 0) {
    blocks.push({
      id: 'existing-pages',
      heading: 'Existing pages on this website',
      body: buildExistingPagesBlock(ctx),
    });
  }
  blocks.push({
    id: 'registry-catalog',
    heading: 'Available section types',
    body: buildRegistryBlock(ctx),
  });
  blocks.push({
    id: 'example',
    heading: 'Example output (Voltline Electrical home page)',
    body: WORKED_EXAMPLE_BODY,
  });
  return blocks;
}

/** Stitch all blocks together as the final prompt string. */
export function composePrompt(ctx: GenerationContext): string {
  return buildPromptBlocks(ctx)
    .map((b) => `## ${b.heading}\n\n${b.body}`)
    .join('\n\n---\n\n');
}

// -- Individual blocks ------------------------------------------------------

function buildSystemPreamble(): string {
  return [
    'You are generating a Page for a small-business website built on the Webnua section registry.',
    '',
    'Output: a single JSON object matching the GeneratedPage schema. No prose, no markdown fences, just JSON.',
    '',
    'Constraints:',
    '- Use only section types listed in "Available section types" below.',
    '- For each section you include, set `enabled: true`.',
    '- Populate every COPY field listed for each section with real, specific, on-brand content built from the business details provided. Never placeholders, never lorem ipsum, never "[business name]"-style tokens.',
    '- DESIGN the page, don\'t just fill it. Decide a design plan like an art director before writing copy: (a) a `surface` rhythm across the page — open strong, alternate "default" and "tinted" bands through the middle, close the final cta on "dark" or "accent" (see the surface notes in the field appendix); (b) deliberate LAYOUT variant picks from each section\'s allowed values — vary alignment, density, and structure so the page feels custom-designed, not templated. An omitted key falls back to the default.',
    '- When you specify a layout field, the catalog enumerates the allowed values — pick exactly one of those values. Variant keys are closed enums, not free text.',
    '- Do NOT output a raw `theme` field on any section — free-form colours are discarded by the validation pipeline. `surface` is the sanctioned colour knob.',
    '- Item-array fields (`items`, `inclusions`, `signals`, `features`, `stats`, `badges`) are arrays of OBJECTS matching the per-section shape in the catalog. Every item needs a short unique `id`. Do not emit items as bare strings.',
    '- `headlineAccent` / `titleAccent` is an optional SECOND LINE rendered in the brand accent colour beneath the main heading. It is not a substring of the headline and not a duplicate of it. Leave empty when no second-line emphasis adds value.',
    '- Headlines: ≤72 chars. Subheadings: ≤140 chars. Bodies: ≤400 chars unless the field is explicitly a paragraph.',
    '- Match the brand voice exactly as described.',
    "- The Industry context block tells you the customer mindset and conversion levers for this trade. Weave the value-proposition and proof-point patterns into copy naturally — paraphrase, never repeat them verbatim, and never claim a certification the brief does not establish (no \"Gas Safe\" if we don't know the trade does gas).",
    "- Match the trade's urgency mode. `emergency-callout` trades (electrician, plumber, locksmith) should lead with response time and route to `Call now`. `scheduled` trades (cleaner, gardener) should lead with reliability and route to `Book a visit` / `Get a quote` — NEVER use emergency-callout urgency framing on scheduled trades. `project` trades (painter, carpenter, roofer) should lead with craft and route to `Get a quote`. `mixed` trades lead with whichever the brief emphasises.",
    '- For every text field you populate, the system will tag it as AI-drafted.',
  ].join('\n');
}

function buildBrandBlock(brand: BrandObject): string {
  const voiceProse = voiceToneToProse(brand.voice);
  const jobsList =
    brand.topJobsToBeBooked.length > 0
      ? brand.topJobsToBeBooked.map((j) => `  - ${j}`).join('\n')
      : '  (none provided)';
  const palette =
    brand.brandColors && brand.brandColors.length > 0
      ? brand.brandColors
      : [brand.accentColor];
  return [
    `Industry: ${brand.industryCategory}`,
    `Audience line: ${brand.audienceLine}`,
    `Brand colours: ${palette.join(', ')}  (the first is the primary brand colour — theme section backgrounds, accents, and buttons from this palette so the page looks on-brand)`,
    '',
    `Voice tone (formality ${brand.voice.formality}/5 · urgency ${brand.voice.urgency}/5 · technicality ${brand.voice.technicality}/5):`,
    `  → ${voiceProse}`,
    '',
    'Top jobs to be booked:',
    jobsList,
  ].join('\n');
}

/** Industry-aware context block. Resolves `brand.industryCategory` (free
 *  text) to a closed `IndustryKey` via `mapIndustry`, then renders the
 *  template's context + value-prop / proof-point / objection patterns + CTA
 *  framing. Unknown industries fall back to `generic` — a strong neutral
 *  template, never broken behaviour. The model is told these are PATTERNS to
 *  weave in, not literal copy to repeat. */
function buildIndustryBlock(brand: BrandObject): string {
  const template: IndustryTemplate = resolveIndustryTemplate(
    brand.industryCategory,
  );
  return renderIndustryPromptBlock(template);
}

/** Industry-knowledge subblock — composed live by the conversational
 *  onboarding's industry-knowledge route. The model is told these are the
 *  authoritative customer pains + desired outcomes for THIS business; weave
 *  them naturally into copy, never repeat verbatim. Source is exposed so
 *  the model knows whether to lean harder on it (`ai` = bespoke per-trade)
 *  or treat it as a safe backup (`template` / `fallback`). */
function buildIndustryKnowledgeBlock(k: NonNullable<GenerationContext['industryKnowledge']>): string {
  const painList =
    k.customerPainPoints.length > 0
      ? k.customerPainPoints.map((p) => `  - ${p}`).join('\n')
      : '  (none captured)';
  const outcomeList =
    k.desiredOutcomes.length > 0
      ? k.desiredOutcomes.map((o) => `  - ${o}`).join('\n')
      : '  (none captured)';
  const trustList =
    k.trustSignals.length > 0
      ? k.trustSignals.slice(0, 8).join(', ')
      : '(none captured)';
  const sourceNote =
    k.source === 'ai'
      ? 'Resolved by an AI knowledge call for this specific industry — treat as authoritative.'
      : k.source === 'template'
        ? 'Derived from the curated industry template — reliable but generic.'
        : 'Safe defaults — generic service-business shape.';
  return [
    `Source: ${sourceNote}`,
    '',
    'Customer pain points (what brings them to this trade):',
    painList,
    '',
    'Desired outcomes (what success looks like to them):',
    outcomeList,
    '',
    `Trust signals customers look for: ${trustList}`,
    '',
    `Voice recommendation for this trade: ${k.voiceRecommendation || '(none captured)'}`,
    '',
    'Weave these pain points + outcomes into the headlines, subheadings, and CTAs naturally. Never repeat them verbatim; they are the conversion levers, not copy.',
  ].join('\n');
}

/** The conversion job each page type has to do — appended to the questions
 *  block so the model treats the page type as a goal, not just a label. */
const PAGE_CONVERSION_PRIORITY: Record<PageType, string> = {
  home: 'Establish trust fast, state the core offer, and route the visitor to book or call. Broad page — carry several proof points.',
  services:
    'Go deep on the service: what is included, the pricing posture, why this business over others, and an FAQ that kills objections before a strong closing CTA.',
  about:
    'Humanise the business — the people, the story, the years of work, why they can be trusted — then convert on that earned trust.',
  contact:
    'Make getting in touch frictionless: phone prominent, hours, service area, and a clear note on what happens after the visitor reaches out.',
  generic:
    'A focused landing page — one offer, one CTA, no distractions. Heavy, specific proof and honest urgency.',
};

function buildQuestionsBlock(ctx: GenerationContext): string {
  const lines: string[] = [
    `Page type: ${describePageType(ctx.pageType)}`,
    `Primary intent: ${describeIntent(ctx.primaryIntent)}`,
    `Audience: ${describeAudience(ctx.audience)}`,
    '',
    `Conversion priority for this page: ${PAGE_CONVERSION_PRIORITY[ctx.pageType]}`,
  ];
  if (ctx.specifics && ctx.specifics.trim().length > 0) {
    lines.push('', 'Specifics from the user (treat as authoritative content):');
    lines.push(quoteBlock(ctx.specifics));
  }
  if (ctx.avoid && ctx.avoid.trim().length > 0) {
    lines.push(
      '',
      'Things to avoid (do not use these terms or make these claims):',
    );
    lines.push(quoteBlock(ctx.avoid));
  }
  return lines.join('\n');
}

function buildExistingPagesBlock(ctx: GenerationContext): string {
  const capped = ctx.existingPages.slice(0, 6);
  return capped
    .map(
      (p, i) =>
        `${i + 1}. ${p.pageTitle}\n   H1: ${p.h1 ?? '(none)'}\n   Primary CTA: ${p.primaryCta ?? '(none)'}\n   Sections: ${p.sectionTypes.join(', ')}`,
    )
    .join('\n\n');
}

function buildRegistryBlock(ctx: GenerationContext): string {
  const eligible = SECTION_REGISTRY_META.filter((def) => isEligible(def, ctx));
  return [
    SHARED_FIELD_NOTES,
    ...eligible.map(formatRegistryEntry),
  ].join('\n\n');
}

function isEligible(def: SectionMeta, ctx: GenerationContext): boolean {
  // Deprecated section types stay in the registry so existing seed data still
  // renders, but the generator must NOT see them as a placement target — the
  // prompt's catalog is the model's pick-from list. (Bundle C2b-3: `services`
  // is deprecated in favour of `features`; if the model emits one anyway the
  // pipeline coerces it via `coerceDeprecatedSection`.)
  if (!def.implemented) return false;
  if (!def.allowedContainers.includes('page')) return false;
  if (def.allowedPageTypes && def.allowedPageTypes.length > 0) {
    return def.allowedPageTypes.includes(ctx.pageType);
  }
  return true;
}

function formatRegistryEntry(def: SectionMeta): string {
  return formatSectionEntry(def);
}

/** Shared per-section formatter — used by the website registry block AND by
 *  the funnel prompt's field-keys block via `formatSectionShape`. Copy fields
 *  are listed first as the model's primary target; layout fields follow with
 *  an explicit omit-unless-required instruction so the model doesn't blindly
 *  fill structural knobs. */
export function formatSectionEntry(def: SectionMeta): string {
  const { copyFields, layoutFields } = partitionFields(def);
  const lines = [
    `### ${def.type}`,
    `Label: ${def.label}`,
    `Description: ${def.description}`,
    `Copy fields (populate with specific, on-brand content):`,
    `  ${copyFields.join(', ') || '(none)'}`,
    `Layout fields (choose DELIBERATELY from the allowed values to give the page a designed feel — vary them across sections rather than leaving everything default; omitting a key applies the default):`,
    `  ${layoutFields.join(', ') || '(none)'}`,
  ];
  const shape = SECTION_SHAPE_CATALOG[def.type];
  if (shape) {
    if (shape.variants.length > 0) {
      lines.push(
        'Variant enums (when you DO specify a layout field, use exactly one of these values):',
      );
      for (const v of shape.variants) {
        const values = v.values.map(formatEnumValue).join(' | ');
        const guidance = v.guidance ? `  — ${v.guidance}` : '';
        lines.push(`  ${v.key}: ${values}${guidance}`);
      }
    }
    if (shape.arrays.length > 0) {
      lines.push(
        'Array fields (each element MUST be an object matching the shape; every item needs a short unique `id`):',
      );
      for (const a of shape.arrays) {
        lines.push(`  ${a.key}: array of ${a.shape}`);
      }
    }
  }
  return lines.join('\n');
}

// =============================================================================
// Copy vs layout partitioning.
//
// The model is asked to populate copy fields (real, specific text the operator
// would never default) but to OMIT layout fields unless the brief justifies a
// variation. SectionMeta.capabilityHints.copyFields is the authoritative source
// when populated — every section in the current registry has it set. The
// heuristic fallback covers future section additions that ship without hints.
// =============================================================================

/** Section keys that are unambiguously structural — closed-enum knobs the
 *  renderer maps to layout / variant decisions. */
const HEURISTIC_LAYOUT_KEYS: ReadonlySet<string> = new Set([
  'theme', 'layout', 'columns', 'mediaStyle', 'iconStyle', 'aspect',
  'stackStyle', 'mediaMode', 'mediaShape', 'imageSide', 'extra',
  'overlay', 'display', 'footer', 'nav',
]);

/** Heuristic suffix patterns for layout fields. Covers `*Style`, `*Size`,
 *  `*Align`, `*Side`, `*Position`, `*Opacity`, `*Visible`. */
const HEURISTIC_LAYOUT_SUFFIX = /(Style|Size|Align|Side|Position|Opacity|Visible)$/;

/** Booleans named `show*` are layout toggles (showHeadlineRule, showDividers,
 *  etc.). The model shouldn't be picking these on a thin brief. */
const HEURISTIC_BOOLEAN_PREFIX = /^show[A-Z]/;

function isLayoutKeyHeuristic(key: string): boolean {
  if (HEURISTIC_LAYOUT_KEYS.has(key)) return true;
  if (HEURISTIC_LAYOUT_SUFFIX.test(key)) return true;
  if (HEURISTIC_BOOLEAN_PREFIX.test(key)) return true;
  return false;
}

/** Split a section's defaultDataKeys into copy + layout buckets. When the
 *  section's `capabilityHints.copyFields` is populated (always, in the
 *  current registry) it is authoritative; otherwise fall back to the
 *  name-based heuristic above. */
function partitionFields(def: SectionMeta): {
  copyFields: string[];
  layoutFields: string[];
} {
  const copyHint = def.capabilityHints?.copyFields;
  const copyFields: string[] = [];
  const layoutFields: string[] = [];
  if (copyHint && copyHint.length > 0) {
    const copySet = new Set(copyHint);
    for (const key of def.defaultDataKeys) {
      if (copySet.has(key)) copyFields.push(key);
      else layoutFields.push(key);
    }
    return { copyFields, layoutFields };
  }
  for (const key of def.defaultDataKeys) {
    if (isLayoutKeyHeuristic(key)) layoutFields.push(key);
    else copyFields.push(key);
  }
  return { copyFields, layoutFields };
}

function formatEnumValue(v: string | number): string {
  return typeof v === 'string' ? `'${v}'` : String(v);
}

// =============================================================================
// Section shape catalog — variant enums + item-array object shapes.
//
// The registry's `defaultDataKeys` is a flat list of strings. Without enum
// values for variant keys, the model emits free-text guesses for fields with
// closed unions (`layout`, `iconStyle`, `contentAlign`, etc.) and the
// renderer silently falls back to defaults — the "layout drift" symptom.
// Without array-element shapes, the model skips array fields whose internal
// shape it can't infer — the "funnel copy mostly blank except headlines"
// symptom. This catalog fixes both.
//
// Source of truth is the section module's TypeScript shape — when you change
// a section's data shape, update the matching entry below. The catalog is
// intentionally inline (not generated) so the prompt stays in one file.
// =============================================================================

type VariantEnum = {
  key: string;
  values: readonly (string | number)[];
  guidance?: string;
};

type ItemArrayShape = {
  key: string;
  /** TypeScript-style object shape. The leading `{` and trailing `}` are
   *  included; the renderer wraps this in `array of ...`. */
  shape: string;
};

type SectionShape = {
  variants: readonly VariantEnum[];
  arrays: readonly ItemArrayShape[];
};

const ICON_ID_NOTE = "an icon id from the curated set (see 'Icon library' above)";

export const SECTION_SHAPE_CATALOG: Partial<Record<SectionType, SectionShape>> = {
  hero: {
    variants: [
      {
        key: 'layout',
        values: ['split', 'overlay', 'minimal'],
        guidance:
          "'split' = image + text columns; 'overlay' = full-bleed image with scrim; 'minimal' = typography only, no image (pair with bundles that prefer editorial restraint or punchy sub-pages).",
      },
      { key: 'imageSide', values: ['left', 'right'] },
      {
        key: 'contentAlign',
        values: ['left', 'center', 'right'],
        guidance: 'center for short marketing-led copy; left for longer or informational copy.',
      },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      { key: 'subSize', values: ['s', 'm', 'l'] },
      {
        key: 'overlayOpacity',
        values: [0, 25, 50, 75, 100],
        guidance: 'only used when layout=overlay; scrim strength over the background image.',
      },
    ],
    arrays: [],
  },
  offer: {
    variants: [
      {
        key: 'layout',
        values: ['card', 'stack'],
        guidance: "'card' = single priced offer with inclusions; 'stack' = value-stack of components.",
      },
      { key: 'headerAlign', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      { key: 'stackStyle', values: ['grid', 'list'] },
      {
        key: 'columns',
        values: [2, 3, 4],
        guidance: 'used in stack mode; pick 2 for paired comparison, 3 for balanced grid, 4 for density.',
      },
    ],
    arrays: [
      { key: 'inclusions', shape: '{ id: string, text: string }' },
      {
        key: 'items',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, title: string, description: string }`,
      },
      {
        key: 'signals',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, label: string }`,
      },
    ],
  },
  features: {
    variants: [
      {
        key: 'layout',
        values: ['cards', 'plain', 'numbered', 'dark-band'],
        guidance:
          "'cards' = V2 icon grid (the default — N cards side by side); 'plain' = the legacy plain-text layout; 'numbered' = V1 vertical list with big bold numbers (no icons, the numbers are the visual); 'dark-band' = V3 full-bleed dark section breaking the page rhythm horizontally. Pick `numbered` for ordered how-it-works lists, `dark-band` to add visual punctuation to a long page, `cards` otherwise.",
      },
      {
        key: 'mediaStyle',
        values: ['icon', 'image', 'image-icon'],
        guidance: "'icon' is the default for service-line lists; pick 'image' only if you have real photos.",
      },
      {
        key: 'iconStyle',
        values: ['soft', 'solid', 'bare'],
        guidance: "'soft' for general business, 'solid' for stronger emphasis, 'bare' for minimal/technical.",
      },
      { key: 'headerAlign', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      { key: 'ctaStyle', values: ['solid', 'outline'] },
      {
        key: 'columns',
        values: [2, 3, 4],
        guidance: '3 is the default balanced grid; 2 for richer per-item copy; 4 for density.',
      },
    ],
    arrays: [
      {
        key: 'items',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, imageUrl: string, title: string, description: string, linkLabel: string, linkHref: string }`,
      },
    ],
  },
  // C2b-3 NOTE: `featuredIndex: number | null` is the item-array asymmetry
  // primitive. When set on the cards layout, the indexed item renders as a
  // wider featured card. Not exposed to the AI by default (the brief usually
  // wants a uniform grid); operator surfaces it in the editor.
  about: {
    variants: [
      {
        key: 'layout',
        values: ['split', 'story-arc'],
        guidance:
          "'split' = V1 two-column layout (copy beside an image, with an optional features list / stats row / signoff / button via `extra`). The V3 'stats-brief' register is reached via split + extra='stats'. 'story-arc' = V2 vertical narrative — eyebrow + headline + lead paragraph + 2-3 chapters of subhead + body + optional middle pull-quote + optional bottom team photo. No media column. Pick story-arc for businesses with a strong founder / heritage / craft story; pick split for credentials-led 'why choose us' framing.",
      },
      { key: 'imageSide', values: ['left', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      {
        key: 'extra',
        values: ['none', 'features', 'stats', 'note', 'button'],
        guidance: "which block follows the intro copy; pick one. Split layout only — story-arc ignores this.",
      },
      { key: 'mediaMode', values: ['single', 'collage'] },
      { key: 'mediaShape', values: ['rounded', 'arc'] },
      { key: 'overlay', values: ['none', 'stat', 'quote'] },
    ],
    arrays: [
      {
        key: 'features',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, title: string, description: string }`,
      },
      {
        key: 'stats',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, value: string, label: string }`,
      },
      // V2 story-arc chapters — 2-3 subhead + body pairs.
      {
        key: 'chapters',
        shape: '{ id: string, heading: string, body: string }',
      },
    ],
  },
  gallery: {
    variants: [
      { key: 'layout', values: ['grid', 'masonry'] },
      { key: 'aspect', values: ['square', 'landscape', 'wide', 'portrait'] },
      { key: 'headerAlign', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      { key: 'ctaStyle', values: ['solid', 'outline'] },
      { key: 'columns', values: [2, 3, 4] },
    ],
    arrays: [
      {
        key: 'items',
        shape: '{ id: string, imageUrl: string, caption: string, category: string }',
      },
    ],
  },
  reviews: {
    variants: [
      {
        key: 'layout',
        values: ['grid', 'spotlight'],
        guidance: "'grid' shows N reviews side-by-side; 'spotlight' features one prominently.",
      },
      { key: 'headerAlign', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      {
        key: 'nav',
        values: ['none', 'dots', 'arrows'],
        guidance:
          "Carousel nav. 'none' = static grid; 'dots' = dot indicators + native swipe carousel; 'arrows' = prev/next buttons + dots + native swipe carousel. The carousel is fully interactive — keyboard, swipe, screen-reader announcements — when nav is dots/arrows.",
      },
      { key: 'ctaStyle', values: ['link', 'solid', 'outline'] },
      { key: 'columns', values: [2, 3] },
    ],
    arrays: [
      {
        key: 'items',
        shape: '{ id: string, quote: string, authorName: string, authorRole: string, avatarUrl: string, rating: 0..5 }',
      },
    ],
  },
  faq: {
    variants: [
      { key: 'layout', values: ['centered', 'grid', 'sidebar'] },
      { key: 'headerAlign', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      {
        key: 'footer',
        values: ['none', 'link', 'card', 'signals'],
        guidance: 'what sits beneath the Q&A list; pick one.',
      },
      { key: 'columns', values: [1, 2] },
    ],
    arrays: [
      { key: 'items', shape: '{ id: string, question: string, answer: string }' },
      {
        key: 'signals',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, title: string, sub: string }`,
      },
    ],
  },
  cta: {
    variants: [
      { key: 'layout', values: ['centered', 'split', 'background', 'dual'] },
      { key: 'align', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      { key: 'imageSide', values: ['left', 'right'] },
      {
        key: 'overlayOpacity',
        values: [0, 25, 50, 75, 100],
        guidance: 'scrim strength when layout=background.',
      },
    ],
    arrays: [
      {
        key: 'signals',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, label: string }`,
      },
    ],
  },
  contact: {
    variants: [
      {
        key: 'layout',
        values: ['details', 'cards', 'map', 'stacked', 'minimal-cta'],
        guidance:
          "'details' is the default (details list + inline form); 'map' if a map image is supplied; 'minimal-cta' = single column, one big CTA, no details grid (use when the bundle prefers restraint, or for sub-pages where the section is one of several CTAs).",
      },
      { key: 'headerAlign', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
    ],
    arrays: [
      {
        key: 'items',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, label: string, value: string, sub: string }`,
      },
    ],
  },
  trust: {
    variants: [
      {
        key: 'display',
        values: ['stats', 'logos', 'compact-icons'],
        guidance:
          "'stats' = a row of N icon+number+label tiles ('500+ jobs', '4.9/5 rating'); 'logos' = client / partner logos; 'compact-icons' = thin horizontal band of small icon + label, with labels rendered as SINGLE WORDS ONLY (each `items[i].label` MUST be one word — 'Insured', 'Vetted', 'Local', 'Certified', not 'Fully insured', 'Background-checked', 'Locally owned'). The pipeline enforces this by abbreviating multi-word labels to their first word; emit single words to avoid the abbreviation. Pick `compact-icons` when the bundle prefers restraint or for a low-friction sub-page social-proof band.",
      },
      { key: 'headerAlign', values: ['left', 'center', 'right'] },
      { key: 'headlineSize', values: ['m', 'l', 'xl'] },
      { key: 'columns', values: [3, 4, 5] },
    ],
    arrays: [
      {
        key: 'items',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, value: string, label: string, rating: 0..5, imageUrl: string }`,
      },
      {
        key: 'badges',
        shape: `{ id: string, icon: ${ICON_ID_NOTE}, label: string }`,
      },
    ],
  },
};

// =============================================================================
// Shared appendix — heading-accent semantics + icon library + item-id rule.
// Emitted once at the top of the registry catalog. Both the website prompt
// (here) and the funnel prompt (via the exported helper) include this.
// =============================================================================

/** Curated icon ids from `lib/website/section-icons.ts`. The renderer
 *  resolves an unknown id to a fallback glyph; staying inside this list keeps
 *  the rendered page on-brand. */
const ICON_LIBRARY: readonly string[] = [
  'award', 'badge-check', 'bath', 'briefcase', 'brush', 'building',
  'calendar', 'camera', 'car', 'check', 'circle-check', 'clock',
  'compass', 'credit-card', 'dollar', 'drill', 'droplet', 'droplets',
  'fan', 'flag', 'flame', 'gauge', 'gift', 'globe', 'hammer',
  'handshake', 'hard-hat', 'headphones', 'heart', 'hourglass', 'house',
  'key', 'layers', 'leaf', 'life-buoy', 'lightbulb', 'lock', 'mail',
  'map-pin', 'megaphone', 'message', 'package', 'paint-roller',
  'paintbrush', 'phone', 'plug', 'recycle', 'rocket', 'ruler',
  'scissors', 'settings', 'shield', 'shield-check', 'shower-head',
  'snowflake', 'sparkles', 'spray-can', 'sprout', 'star', 'sun',
  'tag', 'target', 'thermometer', 'thumbs-up', 'trash', 'tree',
  'trending-up', 'trophy', 'truck', 'users', 'washing-machine', 'wifi',
  'wind', 'wrench', 'zap',
];

export const SHARED_FIELD_NOTES = [
  '### Section colour: the `surface` field (use it!) — never a raw `theme`',
  '',
  'Do NOT output a `theme` field on any section — free-form colours are discarded by the validation pipeline. Instead, every section accepts an optional `surface` field — a closed-set art-direction choice the renderer maps to contrast-safe colours built from the brand palette:',
  '',
  '  surface: "default"  — the standard light surface (brand defaults). The baseline.',
  '  surface: "tinted"   — a soft brand-washed off-white. Gentle change of pace between two light sections.',
  '  surface: "dark"     — a deep, brand-tinted dark band with light text. High drama; great for trust, reviews, or the closing cta.',
  '  surface: "accent"   — the brand colour itself as the background. Loudest option; use at most once per page.',
  '',
  'Design the page like an art director: give it a deliberate light/dark RHYTHM rather than a wall of identical white bands. A typical strong rhythm: open strong (a hero on "dark" or "default" with imagery), alternate "default" and "tinted" through the middle, and close the final cta on "dark" or "accent". Avoid two consecutive "dark" sections; never use "accent" more than once per page. Omitting `surface` means "default".',
  '',
  '### Heading accents',
  '',
  'Sections that expose a `headlineAccent` (or `titleAccent`) render it as an OPTIONAL SECOND LINE beneath the main heading, in the brand accent colour. The accent is NOT a substring of the headline and NOT a duplicate of it — it is an additional clause on its own line.',
  '',
  'Correct:',
  '  headline: "Burst pipe at midnight?"',
  '  headlineAccent: "On site within 2 hours."',
  '',
  'Incorrect (duplicates the headline):',
  '  headline: "Switchboard sorted in 24 hours"',
  '  headlineAccent: "Switchboard sorted in 24 hours"',
  '',
  'Incorrect (accent is a fragment of the headline):',
  '  headline: "Switchboard sorted in 24 hours"',
  '  headlineAccent: "24 hours"',
  '',
  'If no second-line emphasis is warranted, leave the accent field empty.',
  '',
  '### Icon library',
  '',
  'Every `icon` field on an item — and any standalone icon field like `iconStyle`, `badgeIcon`, `footerCardIcon` — must use an id from this curated set. Ids outside the set render as a fallback glyph or get dropped.',
  '',
  ICON_LIBRARY.join(', '),
  '',
  '### Item ids',
  '',
  'Every object inside an `items` / `inclusions` / `signals` / `features` / `stats` / `badges` array needs a short unique `id` string (e.g. "feat-1", "inc-2", "rev-3"). Do not output an item without one.',
].join('\n');

/** Public helper — the funnel prompt uses this to build a per-section block
 *  in the same shape as the website prompt's registry catalog. */
export function formatSectionShape(type: SectionType): string {
  const meta = SECTION_REGISTRY_META.find((m) => m.type === type);
  if (!meta) return '';
  return formatSectionEntry(meta);
}

// -- Voice tone → prose translation -----------------------------------------

export function voiceToneToProse(voice: VoiceTone): string {
  const formality = describeAxis(voice.formality, 'formal', 'casual');
  const urgency = describeAxis(voice.urgency, 'calm', 'urgent');
  const technicality = describeAxis(
    voice.technicality,
    'plain non-technical',
    'technical and precise',
  );
  return `Speak ${formality}, ${urgency}, in ${technicality} language.`;
}

function describeAxis(
  value: number,
  lowLabel: string,
  highLabel: string,
): string {
  if (value <= 1) return `very ${lowLabel}`;
  if (value === 2) return lowLabel;
  if (value === 3) return `balanced between ${lowLabel} and ${highLabel}`;
  if (value === 4) return highLabel;
  return `very ${highLabel}`;
}

// -- Helpers ----------------------------------------------------------------

function quoteBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => `  > ${line}`)
    .join('\n');
}

export function intentLabel(intent: PrimaryIntent): string {
  return describeIntent(intent);
}

// =============================================================================
// Worked example — Voltline Electrical, residential electrical contractor,
// Perth coastal suburbs. Six-section home page demonstrating the shape, the
// quality bar (specific copy, named reviews with suburbs, concrete numbers),
// and the variant + icon choices the catalog above describes. The model
// should produce output of THIS quality, adapted to the brief it receives.
//
// The example is shared across all four AI generation prompts (website,
// funnel step 1, funnel step 2, offer) so the model sees a single consistent
// standard. See CLAUDE.md parked decision "Worked examples".
// =============================================================================

const WORKED_EXAMPLE_BODY = `Here is a complete, well-formed output for a Voltline Electrical home page (residential electrical contractor in Perth coastal suburbs — Cottesloe, Mosman Park, Claremont; owner Mark, 15 years on the tools; differentiators are fixed-quote pricing and same-day emergency response). Use this as the model for shape, specificity, and copy quality. Your output should match this structure and quality bar, adapted to the brief you actually receive — do NOT copy Voltline's specifics (Perth, electrician, 2-hour response, suburbs, owner name) into a different business's page.

\`\`\`json
{
  "title": "Home",
  "slug": "home",
  "seo": {
    "title": "Residential electrician — Cottesloe & Perth coast | Voltline",
    "description": "Fixed-quote residential electrical work across Cottesloe, Mosman Park and Claremont. Switchboards, EV chargers, emergency callouts. Licensed, on time, no surprise charges."
  },
  "sections": [
    {
      "type": "hero",
      "enabled": true,
      "data": {
        "layout": "split",
        "imageSide": "right",
        "contentAlign": "left",
        "headlineSize": "xl",
        "subSize": "m",
        "eyebrow": "// PERTH COASTAL SUBURBS",
        "headline": "Electrical work without the runaround.",
        "headlineAccent": "Fixed quote before we touch a wire.",
        "sub": "Mark and the Voltline team have been wiring Cottesloe, Mosman Park and Claremont homes for 15 years. Switchboards, EV chargers, emergency callouts — done the way Mark would want it done for his own family.",
        "ctaPrimaryVisible": true,
        "ctaPrimaryLabel": "Book a quote",
        "ctaPrimaryHref": "#contact",
        "ctaSecondaryVisible": true,
        "ctaSecondaryLabel": "Call (08) 9384 1100",
        "ctaSecondaryHref": "tel:0893841100"
      }
    },
    {
      "type": "trust",
      "enabled": true,
      "data": {
        "surface": "tinted",
        "display": "stats",
        "columns": 4,
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// WHY HOMEOWNERS PICK US",
        "headline": "15 years on the tools, no surprises on the bill.",
        "sub": "Licensed, insured, and honest about what a job will cost before we start.",
        "items": [
          { "id": "ts-1", "icon": "clock", "value": "15", "label": "Years wiring Perth homes" },
          { "id": "ts-2", "icon": "shield-check", "value": "Licensed", "label": "EC10437 · Master Electricians" },
          { "id": "ts-3", "icon": "circle-check", "value": "Fixed", "label": "Quote before we start" },
          { "id": "ts-4", "icon": "star", "value": "4.9 / 5", "label": "Across 180+ Google reviews" }
        ]
      }
    },
    {
      "type": "features",
      "enabled": true,
      "data": {
        "layout": "cards",
        "mediaStyle": "icon",
        "iconStyle": "soft",
        "columns": 3,
        "headerAlign": "left",
        "headlineSize": "l",
        "eyebrow": "// WHAT WE DO",
        "headline": "Three things we get called for, every week.",
        "sub": "We don't take every job — only the ones we know we can do well. These are the three we do most.",
        "items": [
          {
            "id": "feat-1",
            "icon": "zap",
            "title": "Switchboard upgrades",
            "description": "Old fuse boards swapped for safety-switched boards, paperwork lodged with Western Power. One day on site for most homes."
          },
          {
            "id": "feat-2",
            "icon": "plug",
            "title": "EV charger installation",
            "description": "Tesla, Polestar, BYD wallboxes installed with the right circuit and the right protection. Quoted before the install, set up while we're there."
          },
          {
            "id": "feat-3",
            "icon": "phone",
            "title": "Emergency callouts",
            "description": "Power gone? On site within 2 hours, 7 days a week. We diagnose, fix what we can fix, quote the rest before any work starts."
          }
        ]
      }
    },
    {
      "type": "reviews",
      "enabled": true,
      "data": {
        "surface": "dark",
        "layout": "grid",
        "columns": 3,
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// REVIEWS",
        "headline": "What our Cottesloe and Mosman Park customers say.",
        "sub": "180+ reviews on Google. Three recent ones below.",
        "showRatingSummary": true,
        "ratingStars": 5,
        "ratingValue": "4.9",
        "ratingCount": "180+ Google reviews",
        "items": [
          {
            "id": "rev-1",
            "quote": "Switchboard tripped at 11pm on a Sunday. Mark answered the phone himself and was at the door before midnight. Fixed quote, fixed the problem, lights back on.",
            "authorName": "Sarah W.",
            "authorRole": "Cottesloe",
            "rating": 5
          },
          {
            "id": "rev-2",
            "quote": "Got three quotes for the EV charger. Voltline wasn't the cheapest but Mark walked me through exactly what he'd do and why. No upsells. Job took half a day.",
            "authorName": "James K.",
            "authorRole": "Mosman Park",
            "rating": 5
          },
          {
            "id": "rev-3",
            "quote": "Buyer's inspection flagged the switchboard before settlement. Voltline replaced it inside a week and lodged the paperwork with Western Power. Settlement went through on time.",
            "authorName": "Priya S.",
            "authorRole": "Claremont",
            "rating": 5
          }
        ]
      }
    },
    {
      "type": "offer",
      "enabled": true,
      "data": {
        "layout": "card",
        "headerAlign": "center",
        "headlineSize": "l",
        "tag": "// FIRST-TIME JOBS",
        "title": "Honest pricing — written down before we start.",
        "sub": "We come out, look at the work, write the quote down, and only start when you say yes. The price you sign is the price you pay.",
        "priceLabel": "Free on-site quote",
        "priceCaption": "Most quotes given within 48 hours of booking.",
        "inclusions": [
          { "id": "inc-1", "text": "Quote in writing before any work starts" },
          { "id": "inc-2", "text": "Fixed total — no \\"while I was there\\" surprises" },
          { "id": "inc-3", "text": "Licensed electrician on the job, not a sub" },
          { "id": "inc-4", "text": "12-month workmanship guarantee in writing" }
        ],
        "scarcityCopy": "Booking 1–2 weeks ahead for routine work; emergency callouts same day.",
        "ctaVisible": true,
        "ctaLabel": "Book a quote",
        "ctaHref": "#contact"
      }
    },
    {
      "type": "cta",
      "enabled": true,
      "data": {
        "surface": "dark",
        "layout": "centered",
        "align": "center",
        "headlineSize": "l",
        "eyebrow": "// READY WHEN YOU ARE",
        "headline": "Power out, or planning ahead?",
        "headlineAccent": "Either way, call Mark.",
        "sub": "Two-hour response for emergencies. 48-hour quote turnaround for everything else.",
        "primaryVisible": true,
        "primaryLabel": "Book a quote",
        "primaryHref": "#contact",
        "secondaryVisible": true,
        "secondaryLabel": "Call (08) 9384 1100",
        "secondaryHref": "tel:0893841100",
        "showSignals": true,
        "signals": [
          { "id": "sig-1", "icon": "clock", "label": "2-hour emergency response" },
          { "id": "sig-2", "icon": "shield-check", "label": "Licensed EC10437" },
          { "id": "sig-3", "icon": "circle-check", "label": "Fixed quote in writing" }
        ]
      }
    }
  ]
}
\`\`\`

What this example demonstrates:
- Every section reinforces the SAME pair of differentiators (fixed quote + fast response). One page, one job.
- Concrete numbers everywhere: 15 years, 180+ reviews, 4.9 rating, 2-hour response, 48-hour quote, licence number, suburbs named by name.
- \`headlineAccent\` on hero + final CTA is a SECOND LINE in the brand accent colour ("Fixed quote before we touch a wire." / "Either way, call Mark.") — not a duplicate of the headline, not a fragment of it.
- Reviews are named, suburb-tagged, and reference an actual job done (switchboard at 11pm, EV charger half-day install, settlement on time). No "Great service!" filler.
- Icons come from the curated set (clock, shield-check, circle-check, star, zap, plug, phone) — every \`icon\` value is one of the catalogued ids.
- Variant choices match the catalog (\`layout: 'cards'\`, \`mediaStyle: 'icon'\`, \`iconStyle: 'soft'\`, \`columns: 3\` for features; \`display: 'stats'\` for trust; \`layout: 'grid'\` for reviews) — closed enums, exactly the catalogued values.
- No \`theme\` field on any section. No banned vocabulary (no "comprehensive", "transform", "premium", "leverage", etc.). No invented prices.
`;
