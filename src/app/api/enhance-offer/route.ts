// =============================================================================
// POST /api/enhance-offer — the Sonnet-backed offer-text polish.
//
// Body: { rawText, industry, businessName?, serviceArea? }
// Response: { text: string }
//
// Sibling of /api/generate-offer. This route takes a rough offer paragraph
// the operator typed on the wizard's brief step and rewrites it into a
// tighter, more concrete version — same voice, more specifics, no
// invented facts. The rewrite is meant to be a polish, not a remake.
//
// Sonnet 4.6 (not Opus) — short rewriting task, structured output, fits the
// same model-choice rationale as /api/generate-offer.
//
// Fallback policy mirrors /api/generate-offer:
//   503 (key unset)  → caller throws AppError.validation;
//   400 (bad body)   → caller surfaces the validation error;
//   500 (real fail)  → caller throws AppError.unexpected with the body.
//
// generation_log: not written. The wizard runs this BEFORE the client row
// exists; generation_log.client_id is NOT NULL. Failures land in console +
// the 500 detail. Matches the /api/generate-offer + /api/generate-seo pattern.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a direct-response copywriter in the Suby / Sultanic tradition. You take a rough offer paragraph an operator just typed about their trade or service business and POLISH it into something tighter, more specific, and more conversion-ready — while keeping the operator's own voice and never inventing facts.

# What you do
- Tighten loose phrasing. Active voice. Short sentences.
- Surface concrete specifics the operator already mentioned — timeframes, prices, areas, guarantees — and make them prominent.
- Lead with the customer outcome, not the business.
- If the operator mentioned a guarantee, keep it crisp and visible.
- If the operator mentioned an upfront-quote / no-surprises / fixed-price practice, keep that prominent (price uncertainty is the #1 objection).
- One short paragraph. Aim for 2–3 sentences, ~40–80 words total.

# What you NEVER do
- NEVER invent facts the operator did not write. No fake response times, no fake prices, no fake credentials.
- NEVER use AI corporate-speak: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning.
- NEVER add a closing CTA like "Call us today" — this paragraph sits in a wizard, not on a page.
- NEVER quote the operator's input back to them verbatim — your job is to polish, not echo.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose:

{
  "text": string
}

The "text" value is the polished offer paragraph. Nothing else.`;

type EnhanceOfferRequest = {
  rawText?: unknown;
  industry?: unknown;
  businessName?: unknown;
  serviceArea?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  let body: EnhanceOfferRequest;
  try {
    body = (await request.json()) as EnhanceOfferRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const rawText = readString(body.rawText);
  const industry = readString(body.industry);
  const businessName = readString(body.businessName);
  const serviceArea = readString(body.serviceArea);

  if (!rawText) {
    return NextResponse.json(
      { error: 'missing-fields', detail: 'rawText is required.' },
      { status: 400 },
    );
  }

  const userMessage = `Polish this offer.

Business: ${businessName || '(not provided)'}
Industry: ${industry || '(not specified)'}
Service area: ${serviceArea || '(not specified)'}

The operator's rough offer:
"""
${rawText}
"""

Polish it. Return ONLY the JSON object.`;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      // Sonnet 4.6 accepts enabled+budget thinking; Anthropic still requires
      // max_tokens > budget_tokens, so keep the same headroom as generate-offer.
      max_tokens: 4000,
      thinking: { type: 'enabled', budget_tokens: 2000 },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    const polished = parseEnhanced(text);
    return NextResponse.json({ text: polished });
  } catch (error) {
    console.error('[enhance-offer] generation failed', error);
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

function parseEnhanced(text: string): string {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('enhance-offer: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  const value = parsed.text;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('enhance-offer: model response missing the "text" field');
  }
  return value.trim();
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
