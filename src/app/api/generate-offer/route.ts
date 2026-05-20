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

  const userMessage = `Brief
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
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
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

    const raw = parseOffer(text);
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
