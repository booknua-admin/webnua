// =============================================================================
// POST /api/onboarding/industry-knowledge — per-industry knowledge for the
// conversational onboarding flow.
//
// Body: { industry: string, location?: string, specialty?: string,
//         businessName?: string }
// Response: { knowledge: IndustryKnowledge, source: 'ai' | 'template' | 'fallback' }
//
// The conversational shell fires this once per signup, AFTER the business
// name turn and BEFORE the services picker mounts. The resolved knowledge
// is cached on capturedFacts.industryKnowledge and re-used by offer + site +
// funnel generation downstream — there is no re-fire path V1.
//
// Two roles:
//   - For UNMAPPED industries (anything that resolves to `generic`): the
//     AI knowledge IS the source. Services list drives the picker; pain +
//     outcome + voice ride into the prompts.
//   - For the 10 MAPPED industries: the AI knowledge is supplemental.
//     The template's defaultServices remain authoritative for the picker;
//     the AI's customer_pain_points + desired_outcomes + voice still ride
//     into the prompts (additive — the cached system prompts in
//     generate-site / generate-funnel are untouched).
//
// Sonnet 4.6, thinking enabled (budget_tokens: 2000), max_tokens: 4000.
// Anthropic requires max_tokens > budget_tokens — the 4000-token envelope
// covers the structured ~500-token output after thinking.
//
// Auth: open — matches /api/generate-offer / /api/extract-business. Signup
// pre-dates the client row reference; the result is cached on
// conversation_state via the conversation-state route after the fact.
//
// Fallback:
//   - 503 when ANTHROPIC_API_KEY is unset. Returns the template-derived
//     knowledge (mapped) or generic safe defaults (unmapped) with
//     `source: 'template' | 'fallback'`. Never blocks the signup.
//   - 400 on bad body.
//   - On Anthropic failure / parse failure / validation failure: returns
//     200 with the template/generic fallback + `source: 'fallback'`. The
//     route NEVER 5xx's the caller — the conversational flow MUST proceed.
//
// Rate limit: ai_industry_knowledge — 5/IP/hour. Limit reached returns 429.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import { checkAndRecord } from '@/lib/rate-limit';
import {
  INDUSTRY_TEMPLATES,
  mapIndustry,
  type IndustryKey,
  type IndustryTemplate,
} from '@/lib/website/industry-templates';

export const maxDuration = 30;

const MODEL = 'claude-sonnet-4-6';

function callerIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

const SYSTEM_PROMPT = `You are an industry-knowledge engine for Webnua, a platform building lead-generation websites for small service businesses (any trade or local-service business — electricians, plumbers, cleaners, photographers, accountants, dog groomers, personal trainers, tutors, mechanics, physios, consultants).

You are given ONE industry plus optional location and specialty hints. Your job is to return structured factual knowledge about this trade so Webnua's site + funnel generators can write copy that sounds like the operator wrote it themselves.

You are NOT writing marketing copy. You are NOT making things up. Return concrete, broadly-recognised characteristics of this trade. Default to the common UK / IE / AU shape (English-speaking residential markets).

# Output shape (STRICT)

Return ONLY a single JSON object — no markdown fences, no commentary, exactly this shape:

\`\`\`json
{
  "services": string[],              // 8-15 common offerings for this trade
  "trust_signals": string[],         // 4-8 things customers look for (licenced / insured / years on the tools / etc.)
  "customer_pain_points": string[],  // 3-5 short phrases — what brings customers to this trade
  "desired_outcomes": string[],      // 3-5 short phrases — what success looks like to the customer
  "voice_recommendation": string     // one-line voice note for site copy ("warm and reassuring", "direct and technical", "calm and professional")
}
\`\`\`

# Per-field rules

## services
Closed list of 8-15 common offerings. Title Case, 2-5 words each, no marketing copy. For a wedding photographer: "Engagement Sessions", "Full-Day Wedding Coverage", "Elopement Photography", "Photo Albums", "Second Shooter Service", "Pre-Wedding Consultation", "Online Gallery Delivery", "Print Release". NOT "professional services for your big day".

## trust_signals
4-8 short labels for what a customer in this trade typically looks for before booking. For an accountant: "Chartered status", "Years in practice", "Specialism in your sector", "Fixed-fee pricing", "Same-day response". For a personal trainer: "Certified by REPs / NRTPA", "Years coaching", "Member testimonials", "Insured", "Specialism (strength, weight loss, rehab)".

## customer_pain_points
3-5 short phrases — what's true about a customer who is about to search for this trade. Concrete, not abstract. Bad: "they want quality service". Good: "their last photographer ghosted them three weeks before the wedding"; "their previous accountant let a deadline slip and they got fined"; "their dog has anxiety and the last grooming session traumatised it".

## desired_outcomes
3-5 short phrases — what landing on the right provider means for them. Bad: "satisfaction". Good: "wedding photos they'll actually print"; "tax filed clean and on time, no HMRC letters"; "dog comes home calm, smelling fresh, no nicks".

## voice_recommendation
One line capturing the appropriate voice for site copy. Emergency-callout trades (locksmith, emergency plumber): "direct, calm, fast". Premium services (wedding photography, architects): "warm, considered, confident". Family-trust services (tutors, dog groomers): "warm and reassuring". Technical pros (electricians, accountants): "practical and precise, no jargon". Adapt to the trade.

# Hard constraints

- Never invent industry-specific certifications. If you're unsure whether a trade requires a specific qualification ("Gas Safe", "REPs", "CII"), use generic language ("certified", "qualified") rather than risk being wrong.
- Never include pricing.
- Never use AI corporate-speak: "comprehensive", "premium", "world-class", "industry-leading", "innovative", "seamless", "elevate", "transform", "leverage", "synergy", "trusted partner", "best-in-class", "cutting-edge", "discerning". Banned everywhere.
- For unfamiliar / obscure industries: lean toward GENERIC service-business shape. Return safe categories ("Initial Consultation", "Standard Service", "Premium Service", "Emergency / Urgent Service", "Maintenance") rather than guess at specifics.

# Worked example

Input: { industry: "wedding photographer", location: "Cork", specialty: "destination weddings" }

Output:
\`\`\`json
{
  "services": [
    "Engagement Sessions",
    "Full-Day Wedding Coverage",
    "Half-Day Wedding Coverage",
    "Elopement Photography",
    "Destination Wedding Coverage",
    "Second Shooter Service",
    "Pre-Wedding Consultation",
    "Online Gallery Delivery",
    "Photo Albums",
    "Wall Art Prints",
    "Print Release",
    "Wedding Day Timeline Planning"
  ],
  "trust_signals": [
    "Portfolio of completed weddings",
    "Couple testimonials with venue + date",
    "Insurance for the venue",
    "Backup gear (two bodies, two cards)",
    "Years in business",
    "Specialism in your wedding type",
    "Confirmed delivery timeline",
    "Editing turnaround in writing"
  ],
  "customer_pain_points": [
    "Their last photographer ghosted them weeks before",
    "Worried the photographer won't capture the moments that matter",
    "Hate the awkward stiff poses other couples got",
    "Need someone who'll travel to the destination without surprise fees"
  ],
  "desired_outcomes": [
    "Wedding photos they'll actually print and hang",
    "A photographer who fades into the day, not stage-manages it",
    "Gallery delivered on the agreed date — no follow-up emails needed",
    "Photos that feel like the day actually felt"
  ],
  "voice_recommendation": "warm, considered, confident — not effusive"
}
\`\`\`

Match this quality bar, adapted to whatever industry you receive.`;

type RequestBody = {
  industry?: unknown;
  location?: unknown;
  specialty?: unknown;
  businessName?: unknown;
};

type ResponseKnowledge = {
  services: string[];
  trustSignals: string[];
  customerPainPoints: string[];
  desiredOutcomes: string[];
  voiceRecommendation: string;
  source: 'ai' | 'template' | 'fallback';
};

type RawKnowledge = {
  services?: unknown;
  trust_signals?: unknown;
  customer_pain_points?: unknown;
  desired_outcomes?: unknown;
  voice_recommendation?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const industry = readString(body.industry);
  if (!industry) {
    return NextResponse.json(
      { error: 'industry-required' },
      { status: 400 },
    );
  }
  const location = readString(body.location);
  const specialty = readString(body.specialty);
  const businessName = readString(body.businessName);

  // 503 path: key unset → return the fallback (never a hard failure for the
  // signup). The conversational flow MUST proceed; the cached system prompts
  // downstream use the fallback knowledge to keep generation consistent.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      buildFallbackResponse(industry, 'template'),
    );
  }

  // Rate limit — per-IP. The route does not carry a clientId yet (no
  // workspace exists pre-business-name); IP is the cheapest abuse axis.
  const ip = callerIp(request);
  const decision = await checkAndRecord('ai_industry_knowledge', { key: ip, ip });
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: 'rate-limited',
        detail: decision.message,
        retryAfterSeconds: decision.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  const userMessage = composeUserMessage({
    industry,
    location,
    specialty,
    businessName,
  });

  // Hard timeout. Anthropic SDK supports AbortSignal — wire it via the
  // request body's `signal`. 10s is the brief's locked timeout; if Sonnet
  // hasn't returned by then we fall back so the customer never waits.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);
  try {
    const client = new Anthropic();
    const message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 4000,
        thinking: { type: 'enabled', budget_tokens: 2000 },
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
      },
      { signal: ac.signal },
    );
    clearTimeout(timer);

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    const raw = parseRaw(text);
    const validated = validate(raw);
    if (!validated) {
      console.warn('[industry-knowledge] validation failed, returning fallback', { industry });
      return NextResponse.json(buildFallbackResponse(industry, 'fallback'));
    }

    // For mapped industries — compare AI output against the curated
    // template's defaultServices and warn on material divergence. The
    // template stays authoritative for the picker; this is observability
    // only so we can audit Sonnet's per-trade output over time.
    const industryKey = mapIndustry(industry);
    if (industryKey !== 'generic') {
      logMappedDivergence(industryKey, validated.services);
    }

    const response: ResponseKnowledge = {
      services: validated.services,
      trustSignals: validated.trustSignals,
      customerPainPoints: validated.customerPainPoints,
      desiredOutcomes: validated.desiredOutcomes,
      voiceRecommendation: validated.voiceRecommendation,
      source: 'ai',
    };
    return NextResponse.json({ knowledge: response, source: 'ai' });
  } catch (error) {
    clearTimeout(timer);
    const aborted =
      error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
    console.warn(
      '[industry-knowledge] AI call failed — returning fallback',
      aborted ? '(timed out)' : (error instanceof Error ? error.message : String(error)),
    );
    return NextResponse.json(buildFallbackResponse(industry, 'fallback'));
  }
}

// ---------------------------------------------------------------------------
// Composition + parsing helpers
// ---------------------------------------------------------------------------

function composeUserMessage(args: {
  industry: string;
  location: string;
  specialty: string;
  businessName: string;
}): string {
  const lines: string[] = [
    `Industry: ${args.industry}`,
  ];
  if (args.specialty) lines.push(`Specialty / sub-niche: ${args.specialty}`);
  if (args.location) lines.push(`Location: ${args.location}`);
  if (args.businessName) lines.push(`Business name: ${args.businessName}`);
  lines.push('');
  lines.push('Return the structured knowledge JSON object.');
  return lines.join('\n');
}

function parseRaw(text: string): RawKnowledge {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('industry-knowledge: model response contained no JSON object');
  }
  return JSON.parse(body.slice(start, end + 1)) as RawKnowledge;
}

/** Validate the model response. Returns null when the response is missing
 *  required fields or carries empty arrays where they shouldn't be empty —
 *  the caller falls back to template/generic. */
function validate(raw: RawKnowledge): {
  services: string[];
  trustSignals: string[];
  customerPainPoints: string[];
  desiredOutcomes: string[];
  voiceRecommendation: string;
} | null {
  const services = readStringArray(raw.services).slice(0, 15);
  const trustSignals = readStringArray(raw.trust_signals).slice(0, 8);
  const customerPainPoints = readStringArray(raw.customer_pain_points).slice(0, 5);
  const desiredOutcomes = readStringArray(raw.desired_outcomes).slice(0, 5);
  const voiceRecommendation = readString(raw.voice_recommendation);

  if (services.length < 8) return null;
  if (trustSignals.length < 4) return null;
  if (customerPainPoints.length < 3) return null;
  if (desiredOutcomes.length < 3) return null;
  if (!voiceRecommendation) return null;
  // Defensive: no empty strings inside any array (Sonnet has been known to
  // emit `[""]` when it can't fill a slot — better to fall back than ship).
  if (services.some((s) => !s.trim())) return null;
  if (trustSignals.some((s) => !s.trim())) return null;
  if (customerPainPoints.some((s) => !s.trim())) return null;
  if (desiredOutcomes.some((s) => !s.trim())) return null;

  return {
    services,
    trustSignals,
    customerPainPoints,
    desiredOutcomes,
    voiceRecommendation,
  };
}

// ---------------------------------------------------------------------------
// Fallback synthesis
// ---------------------------------------------------------------------------

/** Compose a `ResponseKnowledge` from the curated industry template when the
 *  industry maps to one of the 10 known trades, or from generic safe
 *  defaults otherwise. `intendedSource` distinguishes 503 (key unset →
 *  template-derived is the expected shape) from an Anthropic failure
 *  (fallback after a real attempt). Both still return 200. */
function buildFallbackResponse(
  industry: string,
  intendedSource: 'template' | 'fallback',
): { knowledge: ResponseKnowledge; source: 'template' | 'fallback' } {
  const industryKey = mapIndustry(industry);
  if (industryKey !== 'generic') {
    const template = INDUSTRY_TEMPLATES[industryKey];
    return {
      knowledge: knowledgeFromTemplate(template, intendedSource),
      source: intendedSource,
    };
  }
  return {
    knowledge: genericSafeKnowledge(intendedSource),
    source: intendedSource,
  };
}

/** Derive the response shape from a curated industry template. Services +
 *  trust signals come straight from the template; pain points + outcomes
 *  are synthesised from the objection-handler patterns (a customer's
 *  objection IS a pain point); the voice recommendation comes from
 *  `contextForModel`'s last sentence-ish heuristic when possible. */
function knowledgeFromTemplate(
  template: IndustryTemplate,
  source: 'template' | 'fallback',
): ResponseKnowledge {
  const services = template.defaultServices.slice(0, 15);
  const trustSignals = template.trustSignals.slice(0, 8);
  // Objection-handler patterns translate to "what the customer worries
  // about" — i.e. pain points. Take the first 3-5.
  const customerPainPoints = template.objectionHandlers
    .map((o) => o.objection)
    .slice(0, 5);
  // Value-propositions describe outcomes — what the customer gets. Take
  // the first 3-5, stripping any leading "We " / "Our " for brevity.
  const desiredOutcomes = template.valuePropositions
    .slice(0, 5)
    .map((p) =>
      p
        .replace(/^(?:We\s+|Our\s+|We'll\s+)/i, '')
        .replace(/^./, (c) => c.toLowerCase()),
    );
  // Voice — synthesise from the urgencyMode. Matches the rules the
  // SYSTEM_PROMPT teaches the AI side to follow.
  const voiceRecommendation =
    template.urgencyMode === 'emergency-callout'
      ? 'direct, calm, fast — customers are panicking'
      : template.urgencyMode === 'scheduled'
        ? 'warm and reliable — emphasise consistency'
        : template.urgencyMode === 'project'
          ? 'considered and craft-led — emphasise care and quality'
          : 'practical and clear — practical-trade voice';
  return {
    services,
    trustSignals,
    customerPainPoints,
    desiredOutcomes,
    voiceRecommendation,
    source,
  };
}

/** Generic safe defaults for unmapped industries when AI is unavailable.
 *  These should NEVER be the customer's main shape — the AI knowledge call
 *  is the whole point — but they keep the conversational flow alive when
 *  things break. */
function genericSafeKnowledge(source: 'template' | 'fallback'): ResponseKnowledge {
  return {
    services: [
      'Initial Consultation',
      'Standard Service',
      'Premium Service',
      'Emergency / Urgent Service',
      'Maintenance',
      'Custom Project',
      'Follow-up Visit',
      'Annual Check',
    ],
    trustSignals: [
      'Local',
      'Insured',
      'Experienced',
      'Trusted by customers',
    ],
    customerPainPoints: [
      'Need it done right',
      'Need it done quickly',
      'Want someone reliable they can call back',
    ],
    desiredOutcomes: [
      'The job complete and done well',
      'A problem solved without follow-up calls',
      'Peace of mind that they hired the right person',
    ],
    voiceRecommendation: 'warm and professional',
    source,
  };
}

/** Log when the AI's services list materially differs from the curated
 *  template for one of the 10 mapped industries. Observability only — does
 *  not block. Comparison is case-insensitive on trimmed strings. */
function logMappedDivergence(industryKey: IndustryKey, aiServices: string[]): void {
  const template = INDUSTRY_TEMPLATES[industryKey];
  const templateSet = new Set(
    template.defaultServices.map((s) => s.trim().toLowerCase()),
  );
  const aiSet = new Set(aiServices.map((s) => s.trim().toLowerCase()));
  const missingFromAi = template.defaultServices.filter(
    (s) => !aiSet.has(s.trim().toLowerCase()),
  );
  const addedByAi = aiServices.filter(
    (s) => !templateSet.has(s.trim().toLowerCase()),
  );
  if (missingFromAi.length === 0 && addedByAi.length === 0) return;
  console.warn(
    `[industry-knowledge] mapped industry "${industryKey}" diverged from template`,
    {
      missingFromAi: missingFromAi.slice(0, 5),
      addedByAi: addedByAi.slice(0, 5),
    },
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim());
}
