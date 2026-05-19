// =============================================================================
// generate-live — the real Claude-backed page generator (server-only).
//
// Replaces the deterministic `generateSync` recipe path with an actual LLM
// call. The prompt construction (generation-prompt.ts) and the §4.4 validation
// pipeline (generation-stub.ts → assembleResult) are unchanged — this module
// only swaps the source of the raw sections from "recipe" to "model".
//
// Imported ONLY by the /api/generate-site route handler — never by client
// code, so the Anthropic SDK stays out of the browser bundle. The browser
// reaches this through `fetch('/api/generate-site')`; see site-generation-stub.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

import type { GenerationContext } from './generation-context';
import { composePrompt } from './generation-prompt';
import {
  assembleResult,
  type GeneratedSection,
  type GenerationResult,
} from './generation-stub';
import type { PageSEO } from './types';

const MODEL = 'claude-opus-4-7';

/** Pins the exact JSON contract. The five context blocks (brand, questions,
 *  registry catalog, …) ride in the user message via composePrompt. */
const SYSTEM_PROMPT = [
  'You are an expert conversion copywriter and web designer generating ONE page',
  'of a small-business website.',
  '',
  'Return ONLY a single JSON object — no markdown fences, no commentary, no prose',
  'before or after. The shape is exactly:',
  '{',
  '  "title": string,                       // human page title',
  '  "slug": string,                        // kebab-case URL slug',
  '  "seo": { "title": string, "description": string },',
  '  "sections": [                          // 5–8 sections, ordered top-to-bottom',
  '    { "type": string, "data": { ... } }  // type ∈ the listed section types;',
  '                                         // data keys = that type\'s field keys',
  '  ]',
  '}',
  '',
  'Rules:',
  '- Use ONLY section types from "Available section types". Lead with a hero;',
  '  end with a cta (or contact on a contact page).',
  '- Populate EVERY field key of each section with real, specific, on-brand copy.',
  '  Never use placeholders or lorem ipsum.',
  '- Write in the exact brand voice described. Use the business\'s real name,',
  '  services, offer, and contact details wherever they are provided.',
  '- Honour the "things to avoid" list strictly.',
].join('\n');

type RawSection = { type?: unknown; data?: unknown };
type RawPage = {
  title?: unknown;
  slug?: unknown;
  seo?: { title?: unknown; description?: unknown } | null;
  sections?: unknown;
};

/** Generate one page with a real Claude call, then run it through the same
 *  validation + assembly pipeline the deterministic stub uses. */
export async function generatePageLive(
  ctx: GenerationContext,
): Promise<GenerationResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  const generationId = `gen-live-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: composePrompt(ctx) }],
  });
  const message = await stream.finalMessage();

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  const raw = parseRawPage(text);
  return assembleResult(ctx, coerceSections(raw.sections), generationId, {
    title: typeof raw.title === 'string' ? raw.title : undefined,
    slug: typeof raw.slug === 'string' ? raw.slug : undefined,
    seo: coerceSeo(raw.seo),
  });
}

// -- Defensive parsing ------------------------------------------------------

/** Extract the JSON object from the model's text — tolerant of stray markdown
 *  fences or leading/trailing prose. Throws if no object can be found. */
function parseRawPage(text: string): RawPage {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('generate-live: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('generate-live: model response was not a JSON object');
  }
  return parsed as RawPage;
}

/** Coerce the model's `sections` array into GeneratedSection[]. Unknown types
 *  and malformed entries are kept through to runValidationPipeline, which
 *  drops + logs them per design doc §4.4. */
function coerceSections(value: unknown): GeneratedSection[] {
  if (!Array.isArray(value)) return [];
  const out: GeneratedSection[] = [];
  for (const entry of value as RawSection[]) {
    if (typeof entry?.type !== 'string') continue;
    const data =
      typeof entry.data === 'object' && entry.data !== null
        ? (entry.data as Record<string, unknown>)
        : {};
    out.push({
      type: entry.type as GeneratedSection['type'],
      enabled: true,
      data,
      // Every field the model actually populated is an AI-drafted field.
      populatedFields: Object.keys(data).filter((k) => data[k] != null),
    });
  }
  return out;
}

function coerceSeo(value: RawPage['seo']): PageSEO | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const title = typeof value.title === 'string' ? value.title : undefined;
  const description =
    typeof value.description === 'string' ? value.description : undefined;
  if (!title && !description) return undefined;
  return { title, description };
}
