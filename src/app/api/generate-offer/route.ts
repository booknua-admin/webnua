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

// FIX (Session X — conversational critical fixes): switched from Sonnet 4.6 +
// extended thinking to Haiku 4.5 without thinking. The offer is four short
// structured strings (~150 output tokens total); Sonnet's thinking budget of
// 2000 tokens was the dominant latency component (>10s perceived) and the
// task is small enough that Haiku handles it fluently when prompted with
// concrete worked examples. The customer-facing UX impact is large — a
// sub-3s settle vs a >10s wait at the moment they're most engaged. The
// few-shot examples below carry the quality bar.
//
// See CLAUDE.md "Funnel-offer generator — Sonnet 4.6 (not Opus)" parked
// decision for the prior reasoning; this update supersedes it for Haiku
// at the same quality bar. Trigger to revisit: if operator review of
// generated offers shows Haiku consistently producing weaker copy than
// Sonnet did with the prior prompt, escalate back to Sonnet and keep
// the few-shot examples.
const MODEL = 'claude-haiku-4-5';

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

# Worked examples — one per trade, each lifted from a real Suby-style direct-response offer

These show the quality bar. Adapt the SHAPE (time-bound promise / specific outcome / concrete risk reversal / first-person CTA), not the wording. Do not invent the timeframes / numbers below for a brief that doesn't contain them — these are illustrative.

## Painter (interior, scheduled work)
Brief: interior repainting in Cork, customer dreads mess + uncertain timeline + paint smell, business guarantees 3-day turnaround + dust-sheet-and-vacuum cleanup.
\`\`\`json
{
  "headline": "Get your interior repainted in 3 days — or we do it for free.",
  "promise": "Two painters, dust sheets down, every room masked, every brush rinsed — done in 3 working days, ready to move furniture back the same evening.",
  "risk_reversal": "If we miss the 3-day deadline, the next room is on the house.",
  "cta_text": "Book my paint job"
}
\`\`\`

## Electrician (emergency callout)
Brief: residential electrical, after-hours call-outs, fixed-quote policy, 60-minute response in service area.
\`\`\`json
{
  "headline": "Sparkie at your door in 60 minutes — or your callout is free.",
  "promise": "Licensed electrician on site within the hour, day or night. We diagnose the fault, give you a fixed quote in writing, and only start work after you say yes.",
  "risk_reversal": "If we're more than 60 minutes from your call, you don't pay the callout fee.",
  "cta_text": "Get my power back on"
}
\`\`\`

## Cleaner (recurring domestic)
Brief: fortnightly home cleaning, customer worry is variable quality + trusting a stranger in the house, business offers a satisfaction guarantee on the first visit.
\`\`\`json
{
  "headline": "First clean free if we don't exceed your expectations.",
  "promise": "Same two cleaners every visit, fully vetted, fully insured. We arrive on time, work to your checklist, and don't leave until every surface passes inspection.",
  "risk_reversal": "If you're not delighted with the first clean, you pay nothing.",
  "cta_text": "Book my first clean"
}
\`\`\`

## Plumber (emergency callout)
Brief: 24/7 plumbing service, burst pipes / leaks, 4-hour response window, fully insured.
\`\`\`json
{
  "headline": "Burst pipe? On site and fixing it in under 4 hours.",
  "promise": "Master plumber dispatched within minutes of your call. Water off in the first 10 minutes, leak diagnosed, parts fitted, area dried — all in one visit.",
  "risk_reversal": "If we can't repair on the first visit, the callout's on us.",
  "cta_text": "Stop my leak now"
}
\`\`\`

## Landscaper (lawn care + garden makeover)
Brief: full garden renovation in 2 weeks, professional turf laying + planting + tidy, written quote with no creep.
\`\`\`json
{
  "headline": "Lawn transformed in 2 weeks — fixed quote, no creep.",
  "promise": "We measure on day one, send a fixed quote within 48 hours, and have your new lawn laid and edges trimmed by the end of week two. Watered, fed, ready for foot traffic.",
  "risk_reversal": "Quote is fixed in writing — no surprise charges added on completion.",
  "cta_text": "Get my lawn quote"
}
\`\`\`

## Roofer (inspection + repair)
Brief: storm damage repair, free inspection, written quote, 48-hour turnaround on the quote itself.
\`\`\`json
{
  "headline": "Roof inspection in 24 hours, written quote within 48.",
  "promise": "Qualified roofer climbs your roof, photographs every problem, and emails you a line-by-line quote within two working days. Repairs scheduled the same week.",
  "risk_reversal": "The inspection is free. The quote is fixed. No charge until you say go.",
  "cta_text": "Book my roof check"
}
\`\`\`

## HVAC (installation + service)
Brief: residential air-con and heat pumps, full design + installation + commissioning, comfort guarantee.
\`\`\`json
{
  "headline": "A perfectly comfortable home — or your money back.",
  "promise": "We size the system to your house, install it in a single day, commission it on the spot, and check on you a week later. Heating works, cooling works, bills make sense.",
  "risk_reversal": "30 days to live with it. Not warm enough or cool enough? Full refund, system removed.",
  "cta_text": "Book my comfort survey"
}
\`\`\`

## Carpenter (custom joinery)
Brief: custom wardrobes / bookshelves / kitchen fit-outs, made-to-measure, agreed deadline.
\`\`\`json
{
  "headline": "Bespoke carpentry — finished by your deadline or it's free.",
  "promise": "On-site measure, hand-drawn plan in your kitchen, made in our workshop, fitted in your home — all to the deadline we agree on day one.",
  "risk_reversal": "Miss the deadline by a day, the job is free.",
  "cta_text": "Get my joinery quote"
}
\`\`\`

## Locksmith (emergency lockout)
Brief: residential lockouts, 30-minute response, licensed and insured, mobile across the city.
\`\`\`json
{
  "headline": "Locked out? 30-minute response, 24 hours a day.",
  "promise": "Licensed locksmith at your door inside half an hour. We open the lock without damaging the door, replace the cylinder if needed, and you're inside in minutes.",
  "risk_reversal": "If we damage the door, we replace it. Written guarantee on every callout.",
  "cta_text": "Get me back inside"
}
\`\`\`

## Handyman (small jobs around the house)
Brief: small fixes and assembly, one-visit completion, fixed hourly rate.
\`\`\`json
{
  "headline": "Job done right the first time — or we redo it free.",
  "promise": "One visit, fixed-rate hour, every common tool in the van. Shelving up, door realigned, leak under the sink sorted — by the time we leave, it's done.",
  "risk_reversal": "If anything breaks again within 30 days, we come back and fix it free.",
  "cta_text": "Book my handyman"
}
\`\`\`

## What these all share
- A pain or a goal NAMED in the headline (locked out / lawn transformed / interior repainted), never the company name.
- A specific timeframe OR a specific outcome (3 days / 60 minutes / 4 hours / "finished by your deadline") — NOT "fast" or "quick".
- A risk reversal the customer can picture and find fair (free callout / first room on the house / quote is fixed / refund + removal).
- A first-person action CTA naming the outcome the customer is buying ("Get my power back on", "Book my first clean", "Stop my leak now") — NOT "Submit", "Click here", "Get started", "Book now", "Learn more".
- No invented prices. No banned vocabulary.

Adapt to the brief in front of you. If the brief carries weaker promises than these examples, USE THE BRIEF'S — never invent stronger ones.

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

Write the four-field offer.`;

  try {
    const client = new Anthropic();

    // Single Sonnet call. No retry-on-price (FIX Session X): the previous
    // retry-once policy doubled latency on the rare invention case, AND the
    // offer is fully editable downstream (every field is an input in the
    // wizard). Detection stays for observability — the warn log surfaces in
    // server logs so an operator can spot a pattern and tune the prompt.
    const raw = await callOffer(client, baseUserMessage);
    if (!briefHasPrice && offerHasPrice(raw)) {
      console.warn(
        '[generate-offer] invented price detected — shipping as-is (offer is editable in the wizard)',
        { fields: priceOffendingFields(raw), brief: { funnelService, funnelGuarantee } },
      );
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
    // FIX (Session X): No `thinking` field — Haiku doesn't accept the
    // extended-thinking shape, and the task (parse a brief, return four
    // short strings against worked examples) doesn't need a reasoning step.
    // 1500 tokens is ample for the ~150-token offer output.
    max_tokens: 1500,
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
