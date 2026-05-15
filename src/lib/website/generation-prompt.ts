// =============================================================================
// generation-prompt — pure prompt-block construction from a GenerationContext.
//
// Why this lives in its own file: this is the part of Session 6 that
// graduates to the real backend when the LLM lands. Keeping it side-effect
// free (no I/O, no React) makes it testable in isolation and rendered
// in the /dev/generation-preview surface (design doc §6a).
// =============================================================================

import type { BrandObject, VoiceTone } from './types';
import type { GenerationContext, PrimaryIntent } from './generation-context';
import { describeAudience, describeIntent, describePageType } from './generation-context';
import { SECTION_REGISTRY } from './sections';
import type { SectionTypeDefinition } from './registry';

export type PromptBlock = {
  id:
    | 'system'
    | 'brand'
    | 'page-questions'
    | 'existing-pages'
    | 'registry-catalog';
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
      id: 'page-questions',
      heading: 'Page questions',
      body: buildQuestionsBlock(ctx),
    },
  ];
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
    '- For each section you include, set `enabled: true` and populate all required fields.',
    '- Headlines: ≤72 chars. Subheadings: ≤140 chars. Bodies: ≤400 chars unless the field is explicitly a paragraph.',
    '- Match the brand voice exactly as described.',
    '- For every text field you populate, the system will tag it as AI-drafted.',
  ].join('\n');
}

function buildBrandBlock(brand: BrandObject): string {
  const voiceProse = voiceToneToProse(brand.voice);
  const jobsList =
    brand.topJobsToBeBooked.length > 0
      ? brand.topJobsToBeBooked.map((j) => `  - ${j}`).join('\n')
      : '  (none provided)';
  return [
    `Industry: ${brand.industryCategory}`,
    `Audience line: ${brand.audienceLine}`,
    `Accent colour: ${brand.accentColor}`,
    '',
    `Voice tone (formality ${brand.voice.formality}/5 · urgency ${brand.voice.urgency}/5 · technicality ${brand.voice.technicality}/5):`,
    `  → ${voiceProse}`,
    '',
    'Top jobs to be booked:',
    jobsList,
  ].join('\n');
}

function buildQuestionsBlock(ctx: GenerationContext): string {
  const lines: string[] = [
    `Page type: ${describePageType(ctx.pageType)}`,
    `Primary intent: ${describeIntent(ctx.primaryIntent)}`,
    `Audience: ${describeAudience(ctx.audience)}`,
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
  const eligible = SECTION_REGISTRY.filter((def) => isEligible(def, ctx));
  return eligible.map(formatRegistryEntry).join('\n\n');
}

function isEligible(
  def: SectionTypeDefinition,
  ctx: GenerationContext,
): boolean {
  if (!def.allowedContainers.includes('page')) return false;
  if (def.allowedPageTypes && def.allowedPageTypes.length > 0) {
    return def.allowedPageTypes.includes(ctx.pageType);
  }
  return true;
}

function formatRegistryEntry(def: SectionTypeDefinition): string {
  const example = def.defaultData() as Record<string, unknown>;
  const fields = Object.keys(example);
  return [
    `### ${def.type}`,
    `Label: ${def.label}`,
    `Description: ${def.description}`,
    `Field keys: ${fields.join(', ') || '(none)'}`,
  ].join('\n');
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
