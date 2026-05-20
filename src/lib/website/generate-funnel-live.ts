// =============================================================================
// generate-funnel-live — the real Claude-backed funnel-landing generator
// (server-only).
//
// Mirror of generate-live.ts but for funnels. ONE Claude call produces the
// seven-section funnel-landing step as one structured JSON response. The
// schedule + thanks steps stay deterministic — they are funnel-only chrome
// (schedulePicker / thanksConfirmation) and the wizard captures none of the
// inputs an LLM would need to differentiate them. The seven landing sections
// are where conversion lives, and where the chosen offer (Session 2) drives
// the structure end to end.
//
// Sultanic / Suby shape, locked at 7 sections in this exact order:
//   1. hero            — leads with the offer headline; sub expands the promise
//   2. offer           — presents the promise as the deal being offered
//   3. reviews (#1)    — first social proof, builds credibility BEFORE the stack
//   4. features        — value stack (3–5 items, each what-it-is + why-it-matters)
//   5. trust           — risk reversal (the guarantee from the offer)
//   6. reviews (#2)    — second social proof, handles final objection
//   7. form            — lead-capture form; CTA copy from the offer
//
// Imported ONLY by /api/generate-funnel — never by client code, so the
// Anthropic SDK stays out of the browser bundle. The browser reaches this
// through fetch('/api/generate-funnel'); see funnel/generation-stub.ts.
//
// Opus 4.7 (vs the offer generator's Sonnet 4.6): funnel generation is
// higher-value than the four-field offer step, the prompt is more complex,
// and the output drives the entire landing page. See the CLAUDE.md parked
// decision "Funnel vs offer generator model choice".
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

import { defaultFormConfig, type FormConfig } from './form-config';
import type {
  FunnelBrief,
  FunnelTestimonial,
} from './site-generation-stub';
import { voiceToneToProse } from './generation-prompt';
import { getSectionMeta } from './sections/registry-meta';
import type { BrandObject, Section, SectionType } from './types';
import type { FallbackLogEntry } from './generation-stub';

const MODEL = 'claude-opus-4-7';

/** Per-section instruction the model treats as authoritative — not just labels. */
const SECTION_PLAN: readonly { type: SectionType; role: string; brief: string }[] = [
  {
    type: 'hero',
    role: 'Open. Hook the visitor on the offer.',
    brief:
      'Lead with the offer headline VERBATIM. Sub expands the promise. Primary CTA = the offer cta_text, href "#form". Secondary CTA = "Call now" / phone if available.',
  },
  {
    type: 'offer',
    role: 'State the deal.',
    brief:
      'Present the offer as the deal being made. Use the promise as the section sub. Inclusions = 3–5 concrete things the customer gets, each one a short noun phrase. No invented prices. CTA = offer cta_text, href "#form".',
  },
  {
    type: 'reviews',
    role: 'First social proof — buy credibility BEFORE the value stack.',
    brief:
      'If the operator supplied at least one testimonial, use ONE here verbatim (the strongest one). If none were supplied, populate generic but specific-feeling reviews (named people, suburb, concrete detail). 2–3 reviews. Headline framed around real customer outcomes, not "what people say".',
  },
  {
    type: 'features',
    role: 'Value stack — 3–5 items that build the case.',
    brief:
      'Each item = a concrete component of the offer with a what-it-is title and a brief why-it-matters description (1 sentence). Together the items add up to the promise. Pick icons that match each item (zap, clock, shield-check, wrench, drill, droplet, etc.).',
  },
  {
    type: 'trust',
    role: 'Risk reversal — present the guarantee.',
    brief:
      'Lead with the risk-reversal copy from the offer. Items = the specific signals that back the guarantee (years in business, licence, insurance, response time, on-time rate, review count). 3–4 items. Use real numbers if the brief carried them; otherwise concrete labels with credible round-number values.',
  },
  {
    type: 'reviews',
    role: 'Second social proof — handle the final objection.',
    brief:
      'Use a DIFFERENT testimonial here than section #3 if a second one is available. Otherwise generate one that names a specific objection-killer (price was honoured, work was tidy, follow-up was good). 1–2 reviews; headline framed as "still on the fence?" — answer the late doubt.',
  },
  {
    type: 'form',
    role: 'CTA + Form — the conversion point.',
    brief:
      'eyebrow + heading from the offer\'s urgency. Heading reuses the customer outcome (e.g. "Book my emergency callout"). Keep it short — the form fields and submit button do the work.',
  },
];

const SYSTEM_PROMPT = `You are a direct-response landing-page copywriter in the Suby / Sultanic tradition, writing for Webnua — a platform building conversion funnels for small service businesses (electricians, plumbers, cleaners, locksmiths, landscapers).

You are writing copy for a seven-section lead-capture funnel. ONE job: maximise form-fills. Every word earns its place.

# How a high-converting funnel works (Suby/Sultanic shape)

1. The funnel sells ONE offer. Every section reinforces the same offer — the headline, promise, risk-reversal, and CTA from the operator's chosen offer ride end to end.
2. The hero opens with the offer headline VERBATIM (the operator already wrote it; do not rewrite).
3. Build trust BEFORE asking the reader to evaluate the value stack — social proof goes before features, not after.
4. The value stack is concrete: 3–5 items, each is a tangible thing the customer gets, with a one-line why-it-matters.
5. The risk-reversal is presented as the customer's guarantee, not a marketing line. Use the operator's own guarantee copy.
6. A second social-proof block AFTER the value stack handles the final objection. Different angle than the first.
7. The form is the only conversion point. CTA copy comes from the offer. No competing CTAs anywhere else on the page (CTAs in earlier sections all scroll to "#form").
8. No corporate-speak. NEVER use: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning. These signal that no human wrote this.
9. Specifics over adjectives. "On site within 2 hours, 7 days a week" beats "fast, reliable service" every time.
10. Use ONLY the testimonials the operator supplied verbatim. NEVER invent quoted testimonials with fake author names if the operator supplied any. If the brief carries zero testimonials, then and only then may you populate the reviews sections with credible-feeling generated reviews — and make them specific (named people, suburb, concrete job detail).

# Section plan (you MUST output sections in this exact order)

${SECTION_PLAN.map((s, i) => `${i + 1}. ${s.type}\n   Role: ${s.role}\n   ${s.brief}`).join('\n\n')}

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. The exact shape:

{
  "sections": [
    { "type": string, "data": { ... } }
  ]
}

Rules:
- Output EXACTLY seven sections, in the order specified above (hero, offer, reviews, features, trust, reviews, form).
- For each section, populate the fields listed in "Section field keys" below. Skip a field by omitting the key (the platform will fall back).
- Item arrays (offer.inclusions, features.items, trust.items, reviews.items) MUST be arrays of objects with the field shapes given. Each item object needs an "id" — use any short unique string (e.g. "feat-1", "rev-2").
- Honour the brand voice exactly. Length: headlines <= 72 chars, subheadings <= 140 chars, body copy <= 400 chars unless explicitly a paragraph.
- Hrefs: every "Book / Get / Buy" CTA href is "#form". Every "Call" CTA href is "tel:" + the operator's phone if available.`;

export type FunnelLandingResult = {
  sections: Section[];
  fallbackLog: FallbackLogEntry[];
};

/** Generate the seven-section funnel landing step with one Claude call, then
 *  run the response through the same validation pipeline shape the website
 *  generator uses (missing fields are logged, never crash the build).
 *
 *  `generationId` lets the caller group all fallback entries under one id —
 *  same pattern as generatePageLive. Defaults to a fresh uuid standalone. */
export async function generateFunnelLandingLive(
  brief: { brand: BrandObject; funnel: FunnelBrief; phone: string; serviceArea: string; industry: string; businessName: string },
  generationId: string = crypto.randomUUID(),
): Promise<FunnelLandingResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const userMessage = composeFunnelUserMessage(brief);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    // Opus 4.7 only accepts `adaptive` thinking — `{ type: 'enabled', budget_tokens }`
    // returns 400 `"thinking.type.enabled" is not supported for this model`.
    // Same shape the website generator uses (`generate-live.ts`).
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });
  const message = await stream.finalMessage();

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  const raw = parseFunnelResponse(text);
  return validateAndAssemble(raw, brief, generationId);
}

// -- Prompt composition -----------------------------------------------------

function composeFunnelUserMessage(brief: {
  brand: BrandObject;
  funnel: FunnelBrief;
  phone: string;
  serviceArea: string;
  industry: string;
  businessName: string;
}): string {
  const offer = brief.funnel.offer;
  const offerBlock = offer
    ? [
        '## Chosen offer (drives the funnel — use these strings as authoritative)',
        '',
        `Headline: ${offer.headline}`,
        `Promise: ${offer.promise}`,
        `Risk reversal: ${offer.riskReversal}`,
        `CTA text: ${offer.ctaText}`,
      ].join('\n')
    : [
        '## Chosen offer',
        '',
        '(none supplied — compose a credible offer from the funnel brief below; lead with the customer pain and promise.)',
      ].join('\n');

  const testimonials = (brief.funnel.testimonials ?? []).filter(isUsableTestimonial);
  const tBlock =
    testimonials.length > 0
      ? [
          '## Testimonials (use these VERBATIM)',
          '',
          ...testimonials.map(
            (t, i) =>
              `${i + 1}. "${t.quote}"\n   — ${t.author}${t.context ? ` (${t.context})` : ''}`,
          ),
        ].join('\n')
      : [
          '## Testimonials',
          '',
          '(none supplied — generate credible specific reviews for the two social-proof sections; named people, suburb, concrete detail.)',
        ].join('\n');

  return [
    `## Business`,
    '',
    `Name: ${brief.businessName || '(unnamed)'}`,
    `Industry: ${brief.industry || brief.brand.industryCategory}`,
    `Service area: ${brief.serviceArea || '(not specified)'}`,
    `Phone: ${brief.phone || '(not provided — omit phone-CTA fields)'}`,
    '',
    `## Brand`,
    '',
    `Audience: ${brief.brand.audienceLine}`,
    `Voice: ${voiceToneToProse(brief.brand.voice)}`,
    brief.brand.topJobsToBeBooked.length > 0
      ? `Top jobs: ${brief.brand.topJobsToBeBooked.join('; ')}`
      : '',
    '',
    `## Funnel brief`,
    '',
    `Service this funnel sells: ${brief.funnel.service || '(not specified)'}`,
    `Customer pain (what makes them urgently search): ${brief.funnel.customerPain || '(not specified)'}`,
    `Guarantee the business will stand behind: ${brief.funnel.guarantee || '(not specified)'}`,
    '',
    offerBlock,
    '',
    tBlock,
    '',
    `## Field keys per section`,
    '',
    buildFieldKeysBlock(),
    '',
    'Write the funnel.',
  ]
    .filter((s) => s !== '')
    .join('\n');
}

function buildFieldKeysBlock(): string {
  const wanted: SectionType[] = ['hero', 'offer', 'reviews', 'features', 'trust', 'form'];
  return wanted
    .map((t) => {
      const meta = getSectionMeta(t);
      if (!meta) return '';
      return `- ${t}: ${meta.defaultDataKeys.join(', ')}`;
    })
    .filter(Boolean)
    .join('\n');
}

function isUsableTestimonial(t: FunnelTestimonial): boolean {
  return Boolean(t && t.quote && t.quote.trim() && t.author && t.author.trim());
}

// -- Defensive parsing ------------------------------------------------------

type RawSection = { type?: unknown; data?: unknown };
type RawFunnel = { sections?: unknown };

function parseFunnelResponse(text: string): RawSection[] {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('generate-funnel-live: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as RawFunnel;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sections)) {
    throw new Error('generate-funnel-live: model response missing sections array');
  }
  return parsed.sections as RawSection[];
}

// -- Validation + assembly --------------------------------------------------

/** Validate the model's seven sections against the registry, drop nulls into
 *  the fallback log, and assemble into platform `Section` shape. A `form`
 *  section gets the default form envelope attached (which the SectionEditor
 *  add-section path also does — see SectionEditor.handleAddSection). */
function validateAndAssemble(
  rawSections: RawSection[],
  brief: { funnel: FunnelBrief },
  generationId: string,
): FunnelLandingResult {
  const fallbackLog: FallbackLogEntry[] = [];
  const out: Section[] = [];

  for (const raw of rawSections) {
    if (typeof raw?.type !== 'string') continue;
    const type = raw.type as SectionType;
    const meta = getSectionMeta(type);
    if (!meta || !meta.allowedContainers.includes('funnelStep')) continue;

    const data =
      typeof raw.data === 'object' && raw.data !== null
        ? { ...(raw.data as Record<string, unknown>) }
        : {};

    // Per-key null/missing check — same shape as runValidationPipeline in
    // generation-stub.ts (we cannot import that pipeline because it is
    // page-typed; the funnel needs funnelStep validation).
    for (const key of meta.defaultDataKeys) {
      const v = data[key];
      if (v === undefined || v === null) {
        fallbackLog.push({
          generationId,
          sectionType: type,
          fieldName: key,
          reason: 'missing',
        });
      }
    }

    const populatedFields = Object.keys(data).filter((k) => data[k] != null);
    const section: Section = {
      id: `sec-${Math.random().toString(36).slice(2, 9)}`,
      type,
      enabled: true,
      data,
      ai: { draftedFields: populatedFields, lastRegenAt: new Date().toISOString() },
    };

    if (type === 'form') {
      section.form = buildFunnelFormConfig(brief.funnel);
    }

    out.push(section);
  }

  return { sections: out, fallbackLog };
}

/** Seed a `form` section's envelope with a default config, then override the
 *  submit label with the offer's CTA text when it is available. */
function buildFunnelFormConfig(funnel: FunnelBrief): FormConfig {
  const base = defaultFormConfig();
  const cta = funnel.offer?.ctaText?.trim();
  return cta ? { ...base, submitLabel: cta } : base;
}
