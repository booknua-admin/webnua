// =============================================================================
// generate-funnel-live — the real Claude-backed funnel generator (server-only).
//
// TWO parallel Claude calls (Opus 4.7), one per non-deterministic step:
//
//   Step 1 — Lead capture (7 sections in Suby/Sultanic shape):
//     hero  →  offer  →  reviews(#1)  →  features  →  trust  →  reviews(#2)  →  form
//     The `form` section is restricted to NAME + EMAIL only (minimum friction
//     to get the lead). The hero ALSO gets the same name+email form attached
//     via `Section.form` envelope — so the visitor can convert above the fold
//     OR at the bottom. Both forms create / update the same lead.
//
//   Step 2 — Qualification (4 sections — reinforcement + qualify):
//     hero  →  reviews  →  features  →  form
//     Sections REINFORCE the booking decision (objection handling + outcomes
//     + what-happens-next), and the form collects phone / service address /
//     preferred date / preferred time-of-day / budget. The lead-link
//     mechanism for stitching step-1 + step-2 submissions lives at the
//     public-renderer + leads/queries level (existingLeadId on submit) and is
//     not the generator's concern.
//
//   Step 3 — Thanks: deterministic, built by funnel/generation-stub.ts.
//
// Imported ONLY by /api/generate-funnel — never by client code, so the
// Anthropic SDK stays out of the browser bundle. The browser reaches this
// through fetch('/api/generate-funnel'); see funnel/generation-stub.ts.
//
// Opus 4.7 with `thinking: { type: 'adaptive' }` (Opus rejects the
// enabled+budget shape — see CLAUDE.md parked decision).
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

import {
  defaultFormField,
  makeFieldId,
  type FormConfig,
  type FormField,
} from './form-config';
import type {
  FunnelBrief,
  FunnelTestimonial,
} from './site-generation-stub';
import {
  SHARED_FIELD_NOTES,
  formatSectionShape,
  voiceToneToProse,
} from './generation-prompt';
import { getSectionMeta } from './sections/registry-meta';
import type { BrandObject, Section, SectionType } from './types';
import type { FallbackLogEntry } from './generation-stub';

const MODEL = 'claude-opus-4-7';

// =============================================================================
// Step 1 — Lead capture
// =============================================================================

/** Per-section instruction the model treats as authoritative — not labels. */
const LEAD_CAPTURE_SECTION_PLAN: readonly { type: SectionType; role: string; brief: string }[] = [
  {
    type: 'hero',
    role: 'Open. Hook the visitor on the offer.',
    brief:
      'Lead with the offer headline VERBATIM. Sub expands the promise. Primary CTA = the offer cta_text, href "#form". Secondary CTA = "Call now" / phone if available. (A short name+email form is rendered into the hero too via the section envelope — your copy is the headline that sells it.)',
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
    role: 'Lead capture — name + email only, minimum friction.',
    brief:
      'eyebrow + heading from the offer\'s urgency. Heading reuses the customer outcome (e.g. "Get my emergency callout"). Keep it short — the form fields and submit button do the work. Visitor only gives name + email here; qualification happens on the next step.',
  },
];

const LEAD_CAPTURE_SYSTEM_PROMPT = `You are a direct-response landing-page copywriter in the Suby / Sultanic tradition, writing for Webnua — a platform building conversion funnels for small service businesses (electricians, plumbers, cleaners, locksmiths, landscapers).

You are writing copy for the FIRST step of a two-step lead-capture funnel. The visitor's first task is the minimum-friction handover: name + email. Every word earns its place toward that single conversion.

# How a high-converting lead-capture page works (Suby/Sultanic shape)

1. The funnel sells ONE offer. Every section reinforces the same offer — the headline, promise, risk-reversal, and CTA from the operator's chosen offer ride end to end.
2. The hero opens with the offer headline VERBATIM (the operator already wrote it; do not rewrite).
3. Build trust BEFORE asking the reader to evaluate the value stack — social proof goes before features, not after.
4. The value stack is concrete: 3–5 items, each is a tangible thing the customer gets, with a one-line why-it-matters.
5. The risk-reversal is presented as the customer's guarantee, not a marketing line. Use the operator's own guarantee copy.
6. A second social-proof block AFTER the value stack handles the final objection. Different angle than the first.
7. The form on this page captures NAME + EMAIL ONLY — minimum friction. Qualification happens on the next step. CTA copy comes from the offer.
8. No corporate-speak. NEVER use: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning. These signal that no human wrote this.
9. Specifics over adjectives. "On site within 2 hours, 7 days a week" beats "fast, reliable service" every time.
10. Use ONLY the testimonials the operator supplied verbatim. NEVER invent quoted testimonials with fake author names if the operator supplied any. If the brief carries zero testimonials, then and only then may you populate the reviews sections with credible-feeling generated reviews — and make them specific (named people, suburb, concrete job detail).

# Section plan (you MUST output sections in this exact order)

${LEAD_CAPTURE_SECTION_PLAN.map((s, i) => `${i + 1}. ${s.type}\n   Role: ${s.role}\n   ${s.brief}`).join('\n\n')}

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. The exact shape:

{
  "sections": [
    { "type": string, "data": { ... } }
  ]
}

Rules:
- Output EXACTLY seven sections, in the order specified above (hero, offer, reviews, features, trust, reviews, form).
- For each section, populate the fields listed in the per-section catalog under "Field keys per section". For variant keys (layout, headerAlign, columns, iconStyle, etc.) the catalog enumerates the allowed values — pick exactly one of those for each variant key. Skip a copy field by omitting the key (the platform will fall back).
- Do NOT output a \`theme\` field on any section. Section themes are applied automatically by the renderer from the brand palette; any \`theme\` you emit will be discarded.
- Item arrays (offer.inclusions, offer.items, offer.signals, features.items, trust.items, trust.badges, reviews.items) MUST be arrays of objects matching the shape given in the catalog. Every item needs a short unique "id" string (e.g. "feat-1", "rev-2"). Do not emit items as bare strings.
- \`headlineAccent\` / \`titleAccent\` is an OPTIONAL SECOND LINE in the accent colour — never duplicate the headline into it. If no second-line emphasis adds value, leave it empty.
- Honour the brand voice exactly. Length: headlines <= 72 chars, subheadings <= 140 chars, body copy <= 400 chars unless explicitly a paragraph.
- Hrefs: every "Book / Get / Buy" CTA href is "#form". Every "Call" CTA href is "tel:" + the operator's phone if available.
- The \`form\` section's \`fields\` array is built deterministically in code — do NOT output a \`fields\` array on the form section. Populate only \`eyebrow\`, \`heading\`.`;

// =============================================================================
// Step 2 — Qualification
// =============================================================================

const QUALIFICATION_SECTION_PLAN: readonly { type: SectionType; role: string; brief: string }[] = [
  {
    type: 'hero',
    role: 'Reframe — the visitor is one step from booked; reassure and steer.',
    brief:
      'The visitor has already given name + email on the previous step. Headline: a short reframe — "Almost there. Let\'s get you on the schedule." Sub: restate the value the visitor is about to receive in concrete terms. NO new offer copy here; reinforce the existing one. Primary CTA = "Confirm my booking", href "#form".',
  },
  {
    type: 'reviews',
    role: 'Social proof, decision-stage angle — "they actually do what they say".',
    brief:
      'Different angle than the landing page: pick testimonials that focus on what the customer experiences AFTER booking — punctual arrival, fixed-quote held, work tidy, follow-up. If the operator supplied testimonials use them verbatim; otherwise generate 2 specific-feeling reviews (named people, suburb).',
  },
  {
    type: 'features',
    role: 'What happens next — a concrete sequence the visitor can picture.',
    brief:
      'Each item is a step in the visitor\'s near future. 3–4 items. Titles are 3–6 words ("We confirm by SMS", "Local pro calls you", "Fixed quote on site"). Descriptions are 1 sentence on what that step looks like and the time it takes. Pick icons (clock, message, shield-check, wrench, phone).',
  },
  {
    type: 'form',
    role: 'Qualify — phone, location, date, time-of-day, budget.',
    brief:
      'eyebrow + heading frame the form as "the final 30 seconds". Heading: action + outcome (e.g. "Lock in your callout"). Sub-heading short. The form fields themselves are wired in code — your job is the heading band copy.',
  },
];

const QUALIFICATION_SYSTEM_PROMPT = `You are a direct-response copywriter writing the SECOND step of a two-step lead-capture funnel for a small service business (trades).

The visitor has already given name + email on the previous step. The job of this page is to REINFORCE the booking decision and qualify the lead with a short follow-up form. No new offer, no new pitch — this is the homestretch.

# How this page works

1. Reassure: the visitor has already converted once; do not re-sell. Reframe their position ("you're almost booked") and steer them to finish.
2. Pre-empt the regret moment. People who hand over name + email often hesitate on the next step ("am I really doing this?"). The reviews + the what-happens-next features answer that hesitation specifically.
3. The features section is NOT marketing — it is a literal sequence of what the visitor will experience next. Concrete steps.
4. The form here qualifies the booking — phone, service address, preferred date, preferred time of day (morning / afternoon / evening), budget. Field UI is wired in code; you write the heading band.
5. No corporate-speak. Banned words: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning.
6. Use ONLY the testimonials the operator supplied verbatim. NEVER invent quoted testimonials with fake author names if the operator supplied any. If none were supplied, generate credible specific-feeling reviews (named people, suburb, concrete detail).

# Section plan (you MUST output sections in this exact order)

${QUALIFICATION_SECTION_PLAN.map((s, i) => `${i + 1}. ${s.type}\n   Role: ${s.role}\n   ${s.brief}`).join('\n\n')}

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose:

{
  "sections": [
    { "type": string, "data": { ... } }
  ]
}

Rules:
- Output EXACTLY four sections, in the order specified above (hero, reviews, features, form).
- For each section, populate the fields listed in the per-section catalog under "Field keys per section". For variant keys (layout, headerAlign, columns, iconStyle, etc.) the catalog enumerates the allowed values — pick exactly one of those for each variant key. Skip a copy field by omitting the key.
- Do NOT output a \`theme\` field on any section. Section themes are applied automatically by the renderer from the brand palette; any \`theme\` you emit will be discarded.
- Item arrays (reviews.items, features.items) MUST be arrays of objects matching the shape given in the catalog. Every item needs a short unique "id" string.
- \`headlineAccent\` / \`titleAccent\` is an OPTIONAL SECOND LINE in the accent colour — never duplicate the headline into it. Leave empty when no second-line emphasis adds value.
- Honour the brand voice. Headlines <= 72 chars; subheadings <= 140; body copy <= 400.
- Hrefs: any CTA href is "#form".
- The \`form\` section's \`fields\` array is built deterministically in code — do NOT output a \`fields\` array. Populate only \`eyebrow\`, \`heading\`.`;

// =============================================================================
// Public entry points
// =============================================================================

export type FunnelStepResult = {
  sections: Section[];
  fallbackLog: FallbackLogEntry[];
};

type LiveBrief = {
  brand: BrandObject;
  funnel: FunnelBrief;
  phone: string;
  serviceArea: string;
  industry: string;
  businessName: string;
};

/** Step 1 — generate the 7-section lead-capture landing. */
export async function generateFunnelLandingLive(
  brief: LiveBrief,
  generationId: string = crypto.randomUUID(),
): Promise<FunnelStepResult> {
  return runFunnelGeneration(brief, generationId, {
    systemPrompt: LEAD_CAPTURE_SYSTEM_PROMPT,
    expectedTypes: ['hero', 'offer', 'reviews', 'features', 'trust', 'reviews', 'form'],
    introNote:
      'Write step 1 — the lead-capture page. Seven sections. The form captures NAME + EMAIL ONLY; the hero ALSO carries the same name+email form via the section envelope.',
    formBuilder: (b) => buildLeadCaptureFormConfig(b.funnel),
    attachHeroFormEnvelope: true,
  });
}

/** Step 2 — generate the 4-section qualification page. */
export async function generateFunnelQualificationLive(
  brief: LiveBrief,
  generationId: string = crypto.randomUUID(),
): Promise<FunnelStepResult> {
  return runFunnelGeneration(brief, generationId, {
    systemPrompt: QUALIFICATION_SYSTEM_PROMPT,
    expectedTypes: ['hero', 'reviews', 'features', 'form'],
    introNote:
      'Write step 2 — the qualification page. Four sections. The form captures phone, service address, preferred date, preferred time-of-day, and budget; the field UI is wired in code — write the heading band copy only.',
    formBuilder: () => buildQualificationFormConfig(),
    attachHeroFormEnvelope: false,
  });
}

// =============================================================================
// Shared call + assembly
// =============================================================================

type RunConfig = {
  systemPrompt: string;
  expectedTypes: readonly SectionType[];
  introNote: string;
  formBuilder: (brief: LiveBrief) => FormConfig;
  /** Step 1 only — attach the same lead-capture form to the hero section so
   *  the visitor can convert above the fold without scrolling. */
  attachHeroFormEnvelope: boolean;
};

async function runFunnelGeneration(
  brief: LiveBrief,
  generationId: string,
  cfg: RunConfig,
): Promise<FunnelStepResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const userMessage = composeUserMessage(brief, cfg);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    // Opus 4.7 requires `adaptive` thinking (rejects enabled+budget).
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: cfg.systemPrompt, cache_control: { type: 'ephemeral' } },
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
  return validateAndAssemble(raw, brief, generationId, cfg);
}

// -- Prompt composition -----------------------------------------------------

function composeUserMessage(brief: LiveBrief, cfg: RunConfig): string {
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
          '(none supplied — generate credible specific reviews for the social-proof sections; named people, suburb, concrete detail.)',
        ].join('\n');

  return [
    cfg.introNote,
    '',
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
    buildFieldKeysBlock(cfg.expectedTypes),
    '',
    'Write the page.',
  ]
    .filter((s) => s !== '')
    .join('\n');
}

function buildFieldKeysBlock(types: readonly SectionType[]): string {
  // De-dupe — `reviews` may appear twice in the lead-capture plan.
  const seen = new Set<SectionType>();
  const blocks: string[] = [SHARED_FIELD_NOTES];
  for (const t of types) {
    if (seen.has(t)) continue;
    seen.add(t);
    const entry = formatSectionShape(t);
    if (entry) blocks.push(entry);
  }
  return blocks.join('\n\n');
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

function validateAndAssemble(
  rawSections: RawSection[],
  brief: LiveBrief,
  generationId: string,
  cfg: RunConfig,
): FunnelStepResult {
  const fallbackLog: FallbackLogEntry[] = [];
  const out: Section[] = [];
  let heroEnvelopeAttached = false;
  const formConfig = cfg.formBuilder(brief);

  for (const raw of rawSections) {
    if (typeof raw?.type !== 'string') continue;
    const type = raw.type as SectionType;
    const meta = getSectionMeta(type);
    if (!meta || !meta.allowedContainers.includes('funnelStep')) continue;

    const data =
      typeof raw.data === 'object' && raw.data !== null
        ? { ...(raw.data as Record<string, unknown>) }
        : {};

    // Theme-discard guard: brand-default theming flows from the renderer.
    // Strip any model-emitted `theme` so per-section overrides don't fight
    // the brand palette. Logged as 'invalid' so the route's generation_log
    // writer can track whether the model is still emitting it.
    if ('theme' in data) {
      const modelValue = data.theme;
      delete data.theme;
      fallbackLog.push({
        generationId,
        sectionType: type,
        fieldName: 'theme',
        reason: 'invalid',
        modelValue,
      });
    }

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
      section.form = formConfig;
    } else if (type === 'hero' && cfg.attachHeroFormEnvelope && !heroEnvelopeAttached) {
      // Step-1 only: attach the SAME lead-capture form to the hero so the
      // visitor can convert above the fold. The `form` section type at the
      // bottom carries the same config — both forms feed the same lead.
      section.form = formConfig;
      heroEnvelopeAttached = true;
    }

    out.push(section);
  }

  return { sections: out, fallbackLog };
}

// =============================================================================
// Form-config builders
// =============================================================================

/** Step 1: name + email only. Submit label = offer.ctaText when available. */
function buildLeadCaptureFormConfig(funnel: FunnelBrief): FormConfig {
  const name: FormField = {
    id: makeFieldId(),
    type: 'text',
    label: 'Your name',
    required: true,
    placeholder: 'Your name',
    leadRole: 'name',
  };
  const email: FormField = defaultFormField('email');
  email.required = true;
  const submitLabel = funnel.offer?.ctaText?.trim() || 'Get started';
  return {
    title: 'Get in touch',
    showTitle: false,
    submitLabel,
    fields: [name, email],
    afterSubmit: { kind: 'nextStep' },
    colors: {},
  };
}

/** Step 2: phone + service address + preferred date + time-of-day + budget. */
function buildQualificationFormConfig(): FormConfig {
  const phone: FormField = defaultFormField('phone');
  phone.required = true;

  const address: FormField = {
    id: makeFieldId(),
    type: 'text',
    label: 'Service address',
    required: true,
    placeholder: 'Where should we come?',
  };

  const preferredDate: FormField = {
    id: makeFieldId(),
    type: 'date',
    label: 'Preferred date',
    required: false,
  };

  const timeOfDay: FormField = {
    id: makeFieldId(),
    type: 'select',
    label: 'Preferred time of day',
    required: false,
    placeholder: 'Pick a window',
    options: ['Morning', 'Afternoon', 'Evening'],
  };

  const budget: FormField = {
    id: makeFieldId(),
    type: 'select',
    label: 'Budget',
    required: false,
    placeholder: 'Ballpark',
    options: ['Under $500', '$500–$2,000', '$2,000–$10,000', '$10,000+', 'Not sure yet'],
  };

  return {
    title: 'Lock in your callout',
    showTitle: false,
    submitLabel: 'Confirm my booking',
    fields: [phone, address, preferredDate, timeOfDay, budget],
    afterSubmit: { kind: 'nextStep' },
    colors: {},
  };
}
