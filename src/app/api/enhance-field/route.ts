// =============================================================================
// POST /api/enhance-field — generic Sonnet-backed freeform-field enhancer.
//
// Body: { fieldName, currentValue, briefContext? }
// Response: { enhanced: string }
//
// Used by the wizard's freeform brief fields (funnel_customer_pain today;
// more freeform fields can opt in via EnhanceableTextarea). The framing is
// "research-grade copywriter who interviews the operator to draw out
// specificity" — distinct from /api/enhance-offer's direct-response /
// conversion-copy framing. Use enhance-offer for the offer paragraph; use
// this route for everything else.
//
// Sonnet 4.6 (not Opus). max_tokens > budget_tokens per Anthropic.
//
// Fallback policy mirrors /api/enhance-offer:
//   503 (key unset)  → caller throws AppError.validation;
//   400 (bad body)   → caller surfaces the validation error;
//   500 (real fail)  → caller throws AppError.unexpected with the body.
//
// generation_log: not written. The wizard runs this BEFORE the client row
// exists; generation_log.client_id is NOT NULL. Failures land in console +
// the 500 detail. Matches the enhance-offer / generate-offer / generate-seo
// precedent.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a research-grade copywriter who interviews trade and service business owners to draw out specificity. The operator just typed a thin description of one aspect of their business — your job is to expand it into a richer version so downstream AI copy generation has more to work with.

# Process
- Read the current value carefully.
- Infer what the business owner means but did not explicitly say. Owners under-state their own expertise constantly.
- Expand into specifics: concrete situations, real timeframes, plain-language detail.
- Keep the operator's voice. The enhancement should feel like a more articulate version of what THEY actually said.

# What you NEVER do
- NEVER invent facts. No fabricated customer counts, years in business, certifications, prices, locations, or response times the operator did not write or imply.
- NEVER pad with generic phrases ("we pride ourselves on", "with years of experience").
- NEVER add AI corporate-speak: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning.
- NEVER add a CTA or marketing close — the enhanced value sits in a wizard form, not on a page.
- NEVER quote the operator's input back verbatim.
- If the input is too thin to expand responsibly (one or two words, no inferable specifics), return a lightly-polished version of what they wrote rather than inventing detail to pad length.

# Worked example (funnel_customer_pain field)

Context: Voltline Electrical, residential electrical contractor in Perth coastal suburbs. The funnel sells emergency callouts for power-out situations.

Operator typed (thin):
"power going out at peoples houses"

Enhanced output:
"Power going out unexpectedly — often at night, often during a storm or after an electrical fault. The family is left without lights, without working refrigeration, sometimes without heating. Most customers have already tried the obvious fixes (resetting the switchboard, checking with neighbours) before they call. They want someone qualified on site fast, with a clear plan and no surprise charges."

Why this works:
- It keeps the operator's actual point — power going out at people's houses — and expands it into the specifics a downstream copy generator can use (when it happens, what the family loses, what the customer has already tried, what they want).
- Nothing invented that the operator did not imply. No fabricated response-time numbers, no fake locations, no "20 years experience" — those come from elsewhere in the brief, not from this field.
- No banned vocabulary, no marketing close, no CTA. This is brief input, not page copy.
- One paragraph, 4 sentences. Reads as a more articulate version of what the operator typed, in their voice.

Your output should match this quality bar, adapted to the actual field and current value you receive.

# Output contract
One paragraph, 2–5 sentences. No preamble, no labels, no markdown.

Return ONLY a single JSON object — no markdown fences, no commentary:

{
  "enhanced": string
}

The "enhanced" value is the expanded paragraph. Nothing else.`;

type BriefContext = {
  businessName?: unknown;
  industry?: unknown;
  serviceArea?: unknown;
  funnelService?: unknown;
};

type EnhanceFieldRequest = {
  fieldName?: unknown;
  currentValue?: unknown;
  briefContext?: BriefContext;
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  let body: EnhanceFieldRequest;
  try {
    body = (await request.json()) as EnhanceFieldRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const fieldName = readString(body.fieldName);
  const currentValue = readString(body.currentValue);
  const ctx = body.briefContext ?? {};
  const businessName = readString(ctx.businessName);
  const industry = readString(ctx.industry);
  const serviceArea = readString(ctx.serviceArea);
  const funnelService = readString(ctx.funnelService);

  if (!fieldName || !currentValue) {
    return NextResponse.json(
      { error: 'missing-fields', detail: 'fieldName and currentValue are required.' },
      { status: 400 },
    );
  }

  const userMessage = `Field: ${fieldName}

Business context:
- Name: ${businessName || '(not provided)'}
- Industry: ${industry || '(not specified)'}
- Service area: ${serviceArea || '(not specified)'}
${funnelService ? `- Funnel service: ${funnelService}\n` : ''}
The operator typed this for "${fieldName}":
"""
${currentValue}
"""

Expand it. Return ONLY the JSON object.`;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
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

    const enhanced = parseEnhanced(text);
    return NextResponse.json({ enhanced });
  } catch (error) {
    console.error('[enhance-field] generation failed', error);
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
    throw new Error('enhance-field: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  const value = parsed.enhanced;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('enhance-field: model response missing the "enhanced" field');
  }
  return value.trim();
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
