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

/** Persona + conversion methodology + the strict JSON output contract. Stable
 *  across every call, so it rides in the cached `system` slot; the per-request
 *  context (brand, questions, registry catalog) rides in the user message via
 *  composePrompt. */
const SYSTEM_PROMPT = `You are a senior conversion copywriter and web designer for Webnua, a platform that builds websites for small service businesses — trades like electricians, plumbers, cleaners, locksmiths, and landscapers. You are generating ONE page of a website.

Your job is not to fill in a template. It is to write a page that turns a visitor into a booked job. Every word earns its place.

# How high-converting pages for these businesses work

1. Lead with the customer's outcome, not the company. The hero headline names the result the visitor wants ("Power back on the same day — no callout fee") — never what the business does ("Quality electrical services").
2. Be concrete. Use real numbers, real timeframes, the real service area, the real guarantee. "Same-day callout across the service area, 7 days a week" beats "fast, reliable service" every time. Never write vague filler — no "quality you can trust", no "we go the extra mile", no "your satisfaction is our priority".
3. Build trust early and often. These customers are letting a stranger into their home — they are risk-averse. Surface licensing, insurance, years in business, the review count and rating, and the workmanship guarantee. Put a trust signal near every ask.
4. One job per page. Every section pushes the visitor toward the SAME primary action. No competing calls to action.
5. Answer the objection before it is asked. Price uncertainty → "upfront quote, no surprises". "Will they actually turn up?" → an on-time promise plus reviews. "Are they any good?" → specific proof.
6. Write in the customer's words, not trade jargon — unless the brand voice is explicitly technical. Describe the problem the way the customer would say it.
7. Social proof must feel real — named reviewers, their suburb, the actual job done, a specific detail. Generic "Great service!" testimonials convert nothing.
8. CTAs are action-led and low-friction, and they repeat down the page. The CTA must match the page's primary intent: "Book" for a booking, a tap-to-call phone number for calls, "Get your free quote" for quotes.
9. Use urgency only when it is honest. Emergency trades can lean on "we answer 24/7"; never manufacture fake countdowns or fake scarcity.
10. The page must work when skimmed — benefit-led subheadings, short sentences, scannable. A reader who only skims still gets the offer and the next step.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. The exact shape:

{
  "title": string,                       // SHORT page name — the header-menu / browser-tab label. 1-3 plain words ("Home", "Services", "About", "Contact"). NOT an SEO sentence.
  "slug": string,                        // kebab-case URL slug
  "seo": { "title": string, "description": string },  // the LONG keyword-rich SEO meta title goes in seo.title — never in "title"
  "sections": [                          // 5-8 sections, ordered top to bottom
    { "type": string, "data": { ... } }  // type from the listed section types;
                                         // data keys = that type's field keys
  ]
}

Rules:
- "title" is the short page name shown in the header menu and the browser tab — keep it to 1-3 plain words ("Home", "Services", "About", "Contact"). The long, keyword-rich SEO title belongs in "seo.title". Never put SEO phrasing, the business name, or a location list in "title".
- Use ONLY section types from "Available section types". Lead with a hero; close with a cta (or a contact section on a contact page).
- Each section type lists its fields split into two buckets: COPY fields and LAYOUT fields.
- Populate every COPY field with real, specific, on-brand content built from the business details provided. Never placeholders, never lorem ipsum, never "[business name]"-style tokens.
- DESIGN the page, don't just fill it. Before writing copy, decide a design plan like an art director: (a) a "surface" rhythm across the page — open strong, alternate light and tinted bands through the middle, close the final cta on a dark or accent band (see the surface notes in the field appendix); (b) deliberate LAYOUT variant picks from each section's allowed enum values — vary alignment, density, and structure across sections so the page feels custom-designed, not templated. Two different businesses should not get the same skeleton. Stay strictly inside the listed enum values; an omitted key falls back to the default.
- Match the brand voice exactly as described, and honour the "things to avoid" list without exception.
- Length discipline: headlines <= 72 characters, subheadings <= 140 characters, body copy <= 400 characters unless the field is explicitly a paragraph.`;

type RawSection = { type?: unknown; data?: unknown };
type RawPage = {
  title?: unknown;
  slug?: unknown;
  seo?: { title?: unknown; description?: unknown } | null;
  sections?: unknown;
};

/** Generate one page with a real Claude call, then run it through the same
 *  validation + assembly pipeline the deterministic stub uses.
 *
 *  `generationId` lets the caller group all pages of one site-generation
 *  run under a single id — the shape `generation_log.generation_id` is
 *  designed for (one site-generation → one uuid → N rows, one per
 *  fallback field). Defaults to a fresh uuid when called standalone. */
export async function generatePageLive(
  ctx: GenerationContext,
  generationId: string = crypto.randomUUID(),
): Promise<GenerationResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    // The methodology + contract is stable — cache it across the four
    // per-page calls of a generation (and across generations).
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
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
