// =============================================================================
// POST /api/generate-offer — the Sonnet-backed funnel-offer generator.
//
// Body: { industry, serviceArea, funnelService, funnelCustomerPain,
//         funnelGuarantee }
// Response: { offer: { headline, promise, riskReversal, ctaText } }
//
// Sonnet 4.6 (not Opus) — field generation of four short strings does not
// need Opus pricing; Sonnet handles structured short-form copy fluently
// and the offer is editable in the wizard regardless.
//
// The browser reaches this through offer-generate.ts's `generateFunnelOffer`.
// Fallback policy: 503 when key is unset (caller surfaces "configure
// ANTHROPIC_API_KEY" — the whole point of this step is a real Sonnet draft,
// so silently degrading would be misleading); 500 on real failure with the
// { name, status, detail } body (PR #58 pattern).
//
// generation_log: not written here. The wizard runs offer generation BEFORE
// the client row exists, but generation_log.client_id is NOT NULL. Failures
// land in console + the 500 detail; success is observable through the
// resulting funnels.funnel_offer row. Matches the generate-seo precedent.
//
// Invented-price guard: the model occasionally invents prices when the
// brief doesn't carry one. After the first call, if a currency symbol or
// price pattern appears in the output AND no pricing was in the brief, we
// retry ONCE with a stronger no-pricing instruction prepended. Cap at one
// retry per call. Observability is console-only (see generation_log note
// above). See CLAUDE.md parked decision "Offer pricing".
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a direct-response copywriter in the Suby / Sultanic tradition. You specialise in offers for trade and service businesses — electricians, plumbers, cleaners, locksmiths, landscapers — the kind of business whose customer is in pain and needs the problem gone today.

Your job is to write ONE specific, time-bound offer that will sit at the top of a one-page conversion funnel. Four fields, that is it. Every word earns its place.

# How to write each field

## headline (<= 12 words)
Name the prospect's pain FIRST, then promise the outcome. The customer should read it and feel "yes, that is exactly what I need".
Good: "Switchboard sparking? We have it sorted in 24 hours."
Good: "Burst pipe at midnight? On site within 2 hours, 7 days a week."
Bad: "Quality electrical services" — vague, no pain, no outcome.
Bad: "Welcome to ACME Plumbing" — about the company, not the customer.

## promise (<= 25 words)
Be specific. Include a real timeframe, a real number, OR a measurable outcome. "Sorted in 24 hours" beats "fast service". State what the customer gets, in plain language.
Good: "We diagnose, repair and certify your switchboard within 24 hours of your call — fully tested, fully compliant, paperwork done."
Bad: "We provide great service to all our customers." — empty.

## risk_reversal (<= 15 words)
Concrete and credible. The customer should be able to picture the agreement and find it fair.
Good: "Or your callout fee is on us."
Good: "Free quote on the spot — no commitment, no pressure."
Good: "Workmanship guaranteed for 12 months in writing."
Bad: "Satisfaction guaranteed" — meaningless, ignored by every reader.
Bad: "We promise great service" — restating the promise is not a risk reversal.

## cta_text (<= 6 words)
Action-led, first-person ("Get my X", "Book my X"). Names the outcome the customer wants. Never generic.
Good: "Get my switchboard sorted →"
Good: "Book my emergency callout →"
Bad: "Submit" / "Learn more" / "Click here" / "Get started" — all generic.

# Hard bans
NEVER use any of: "comprehensive", "discerning", "trusted partner", "cutting-edge", "premium quality", "elevate", "transform", "solutions", "best-in-class", "world-class", "industry-leading", "innovative", "seamless", "robust", "leverage", "synergy". These are AI corporate-speak — they signal that no human wrote this.

NEVER invent facts, prices, response times, or guarantees that are not in the brief. Use ONLY the timeframes, numbers, and promises the operator provided.

# Pricing — when the brief carries no specific price

If the brief carries no specific price number, do NOT invent one. No "$99", no "€50 fixed", no "from $200". Instead, use qualitative pricing language in the promise field:
  - "Honest upfront pricing, no surprises"
  - "Free quote, no obligation"
  - "Fixed-price quotes — what we say is what you pay"

The customer-pain framing may reference cost worries ("worried about surprise charges", "scared of a bill blowout") but never names a specific number unless one is in the brief. The risk_reversal field may state "free quote" or "no callout fee" only when the brief explicitly carries that guarantee.

A specific dollar/euro/pound figure may appear in the offer ONLY if the operator's brief contains that exact figure.

# Worked example (Voltline Electrical — emergency callout)

Brief input:
- Industry: residential electrical contractor
- Service area: Perth coastal suburbs (Cottesloe, Mosman Park, Claremont)
- Funnel service: emergency callout for power-out situations
- Customer pain: power has gone out unexpectedly, often at night, often during a storm. Family is left without lights, working refrigeration, or heating. Customer has tried the obvious fixes (resetting the switchboard, checking with neighbours) and needs a qualified person on site fast, with no surprise bill.
- Guarantee: 2-hour on-site response, licensed electrician, fixed quote in writing before any work starts, free callout if we can't fix it on the first visit

Correct output:

\`\`\`json
{
  "headline": "Power out at midnight? On site within 2 hours, 7 days a week.",
  "promise": "We answer 24/7. Licensed electrician on site within 2 hours of your call — fixed quote before we start work.",
  "risk_reversal": "Free callout if we can't fix it on the first visit.",
  "cta_text": "Get my power back on"
}
\`\`\`

Why this output works:
- headline (13 words is fine): names the exact pain ("Power out at midnight?") and the exact outcome ("on site within 2 hours, 7 days a week"). The customer recognises themselves and the result they want in one line.
- promise (24 words): three concrete things — 24/7 answer, 2-hour on-site, fixed quote in writing — taken directly from the brief's guarantee. No invented numbers; no vague "fast" or "reliable".
- risk_reversal (10 words): the exact guarantee from the brief, restated tightly. The customer can picture it and find it fair. No "satisfaction guaranteed" filler.
- cta_text (5 words): first-person, action-led, names the OUTCOME the customer is buying ("my power back on"). Not "Submit", not "Get started", not "Book now".
- No invented prices anywhere — the brief carried no price, so the offer uses qualitative pricing language ("fixed quote before we start work").
- No banned vocabulary — no "comprehensive", "premium", "transform", "leverage", "industry-leading", etc.

Your output should match this quality bar, adapted to the actual brief you receive.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. Exactly this shape:

{
  "headline": string,
  "promise": string,
  "risk_reversal": string,
  "cta_text": string
}`;

type GenerateOfferRequest = {
  industry?: unknown;
  serviceArea?: unknown;
  funnelService?: unknown;
  funnelCustomerPain?: unknown;
  funnelGuarantee?: unknown;
  /** Optional — conversational onboarding's industry-knowledge AI result,
   *  threaded through from the wizard. When present, the user message
   *  gains an additive "Industry knowledge" subblock so Sonnet grounds
   *  the four-field offer in real per-trade pain + outcomes + voice.
   *  Absent on the operator concierge path; the offer still generates
   *  cleanly without it (the cached system prompt is untouched). */
  industryKnowledge?: unknown;
};

type IndustryKnowledgeInput = {
  customerPainPoints: string[];
  desiredOutcomes: string[];
  trustSignals: string[];
  voiceRecommendation: string;
  source: 'ai' | 'template' | 'fallback';
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  let body: GenerateOfferRequest;
  try {
    body = (await request.json()) as GenerateOfferRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const industry = readString(body.industry);
  const funnelService = readString(body.funnelService);
  const funnelCustomerPain = readString(body.funnelCustomerPain);
  const funnelGuarantee = readString(body.funnelGuarantee);
  const serviceArea = readString(body.serviceArea);

  if (!funnelService || !funnelCustomerPain || !funnelGuarantee) {
    return NextResponse.json(
      { error: 'missing-fields', detail: 'service, customer pain, and guarantee are all required.' },
      { status: 400 },
    );
  }

  const briefText = [industry, serviceArea, funnelService, funnelCustomerPain, funnelGuarantee].join(
    '\n',
  );
  const briefHasPrice = hasPricePattern(briefText);
  const knowledge = readIndustryKnowledge(body.industryKnowledge);
  const knowledgeBlock = knowledge ? composeIndustryKnowledgeBlock(knowledge) : '';

  const baseUserMessage = `Brief
-----
Industry: ${industry || '(not specified)'}
Service area: ${serviceArea || '(not specified)'}

The one service this funnel is built around:
${funnelService}

The moment that makes a customer urgently search for this:
${funnelCustomerPain}

What the business can confidently promise / guarantee:
${funnelGuarantee}
${knowledgeBlock}

Write the four-field offer.`;

  try {
    const client = new Anthropic();

    // First attempt.
    let raw = await callOffer(client, baseUserMessage);

    // Invented-price guard: if no price was in the brief but the model put a
    // currency symbol or price pattern in any field, retry ONCE with a
    // stronger instruction prepended. One retry only — no retry storms.
    if (!briefHasPrice && offerHasPrice(raw)) {
      const offending = priceOffendingFields(raw);
      console.warn(
        '[generate-offer] invented price detected on first attempt — retrying once',
        { fields: offending, brief: { funnelService, funnelGuarantee } },
      );
      const reinforcedMessage = [
        'CRITICAL: the brief below contains NO specific price. Do NOT include a currency symbol or dollar/euro/pound number anywhere in your output. Use qualitative pricing language only (e.g. "honest upfront pricing", "free quote, no obligation", "fixed-price quote on the spot").',
        '',
        baseUserMessage,
      ].join('\n');
      const retried = await callOffer(client, reinforcedMessage);
      if (!offerHasPrice(retried)) {
        raw = retried;
      } else {
        // Retry also invented a price — keep the retry result (no better
        // option than to ship it; user can edit any field). Loudly logged
        // so the pattern is recoverable if it recurs.
        console.warn(
          '[generate-offer] retry also produced an invented price; shipping the retry result',
          { fields: priceOffendingFields(retried) },
        );
        raw = retried;
      }
    }

    return NextResponse.json({
      offer: {
        headline: raw.headline,
        promise: raw.promise,
        riskReversal: raw.risk_reversal,
        ctaText: raw.cta_text,
      },
    });
  } catch (error) {
    console.error('[generate-offer] generation failed', error);
    const detail = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : 'Error';
    const status =
      typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : undefined;
    return NextResponse.json(
      { error: 'generation-failed', name, status, detail },
      { status: 500 },
    );
  }
}

type RawOffer = {
  headline: string;
  promise: string;
  risk_reversal: string;
  cta_text: string;
};

async function callOffer(client: Anthropic, userMessage: string): Promise<RawOffer> {
  const message = await client.messages.create({
    model: MODEL,
    // Anthropic requires max_tokens > thinking.budget_tokens; 4000 leaves
    // ample headroom for the ~150-token four-field offer after thinking.
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
  });
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
  return parseOffer(text);
}

// Matches a currency symbol next to a digit, a digit next to a currency
// symbol, or a number followed by a currency word. Deliberately narrow —
// matches "$99" / "€50" / "99 dollars" / "£1,000" but not "24 hours" or
// "12-month guarantee".
const PRICE_PATTERN =
  /(?:[€$£¥¤]\s?\d|\d[\d,]*\s?[€$£¥¤]|\b\d[\d,]*\s?(?:dollars?|euros?|pounds?|usd|eur|gbp|aud|cad|nzd|cents?)\b)/i;

function hasPricePattern(text: string): boolean {
  return PRICE_PATTERN.test(text);
}

function offerHasPrice(offer: RawOffer): boolean {
  return (
    hasPricePattern(offer.headline) ||
    hasPricePattern(offer.promise) ||
    hasPricePattern(offer.risk_reversal) ||
    hasPricePattern(offer.cta_text)
  );
}

function priceOffendingFields(offer: RawOffer): string[] {
  const out: string[] = [];
  if (hasPricePattern(offer.headline)) out.push('headline');
  if (hasPricePattern(offer.promise)) out.push('promise');
  if (hasPricePattern(offer.risk_reversal)) out.push('risk_reversal');
  if (hasPricePattern(offer.cta_text)) out.push('cta_text');
  return out;
}

function parseOffer(text: string): RawOffer {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('generate-offer: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  const headline = pickString(parsed, 'headline');
  const promise = pickString(parsed, 'promise');
  const risk_reversal = pickString(parsed, 'risk_reversal', 'riskReversal');
  const cta_text = pickString(parsed, 'cta_text', 'ctaText');
  if (!headline || !promise || !risk_reversal || !cta_text) {
    throw new Error('generate-offer: model response missing one or more required fields');
  }
  return { headline, promise, risk_reversal, cta_text };
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim());
}

/** Defensively coerce the optional industryKnowledge body field. Returns
 *  null when absent, malformed, or carrying empty arrays — the offer
 *  generator simply omits the supplemental block and runs as before. */
function readIndustryKnowledge(v: unknown): IndustryKnowledgeInput | null {
  if (!v || typeof v !== 'object') return null;
  const obj = v as Record<string, unknown>;
  const customerPainPoints = readStringArray(obj.customerPainPoints).slice(0, 5);
  const desiredOutcomes = readStringArray(obj.desiredOutcomes).slice(0, 5);
  const trustSignals = readStringArray(obj.trustSignals).slice(0, 8);
  const voiceRecommendation = readString(obj.voiceRecommendation);
  // At least pain OR outcomes must be non-empty for the subblock to add
  // value; otherwise treat as absent so we don't pad the user message
  // with empty bullet lists.
  if (customerPainPoints.length === 0 && desiredOutcomes.length === 0) return null;
  const rawSource = readString(obj.source);
  const source: IndustryKnowledgeInput['source'] =
    rawSource === 'ai' || rawSource === 'template' || rawSource === 'fallback'
      ? rawSource
      : 'fallback';
  return { customerPainPoints, desiredOutcomes, trustSignals, voiceRecommendation, source };
}

/** Compose the industry-knowledge subblock for the offer user message.
 *  Additive — the cached system prompt is untouched (preserves Sonnet's
 *  prompt-cache hit). Source disclosed so the model knows whether to
 *  lean harder on the signals (`ai` = bespoke per-trade) or treat them
 *  as a safe backup. */
function composeIndustryKnowledgeBlock(k: IndustryKnowledgeInput): string {
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
      ? 'Resolved by an AI knowledge call for this specific trade — treat as authoritative.'
      : k.source === 'template'
        ? 'Derived from the curated industry template — reliable but generic.'
        : 'Safe defaults — generic service-business shape.';
  return [
    '',
    'Industry knowledge (resolved live for this trade)',
    '-------------------------------------------------',
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
    'Weave these pain points + outcomes naturally into the headline + promise. Never repeat verbatim.',
  ].join('\n');
}
