// =============================================================================
// POST /api/rewrite-field — Sonnet-backed builder-copy rewrite.
//
// Body: { fieldName, currentValue, context? }
// Response: { rewritten: string }
//
// Used by the in-editor `✦ Regen` affordance on short/medium copy fields.
// Unlike /api/enhance-field, this route rewrites customer-facing website copy
// rather than expanding a brief field. The prompt therefore optimises for
// "say the same thing better" while respecting brevity.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a senior conversion copywriter rewriting one field inside a small-business website builder.

Your job is to produce ONE improved alternate draft for the specific field value the editor selected.

# What "rewrite" means here
- Keep the same core meaning unless the original is clearly weak, vague, bloated, or awkward.
- Make it sharper, more specific, more natural, and more persuasive.
- Respect the fact that this text sits inside a website section, not a long article.
- Preserve rough length discipline. If the original is short, keep it short. If it is a paragraph, keep it a paragraph.
- Honour the business context and audience cues when they exist.

# What you NEVER do
- NEVER invent facts, numbers, guarantees, locations, credentials, pricing, years in business, or review counts.
- NEVER turn plain language into AI sludge.
- NEVER add a CTA if the original field is not a CTA.
- NEVER add markdown, labels, quotation marks around the answer, or multiple options.
- NEVER explain your reasoning.

# Length discipline
- Headline / title / button-like copy: stay concise.
- Subhead / description / body copy: keep similar length to the input unless a modest expansion materially improves clarity.

# Output contract
Return ONLY a single JSON object:

{
  "rewritten": string
}

The value must be one alternate version of the input field, ready to paste into the builder.`;

type RewriteFieldRequest = {
  fieldName?: unknown;
  currentValue?: unknown;
  context?: {
    sectionLabel?: unknown;
    industry?: unknown;
    audienceLine?: unknown;
  };
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  let body: RewriteFieldRequest;
  try {
    body = (await request.json()) as RewriteFieldRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const fieldName = readString(body.fieldName);
  const currentValue = readString(body.currentValue);
  const sectionLabel = readString(body.context?.sectionLabel);
  const industry = readString(body.context?.industry);
  const audienceLine = readString(body.context?.audienceLine);

  if (!fieldName || !currentValue) {
    return NextResponse.json(
      { error: 'missing-fields', detail: 'fieldName and currentValue are required.' },
      { status: 400 },
    );
  }

  const userMessage = `Field: ${fieldName}
Section: ${sectionLabel || '(not specified)'}
Industry: ${industry || '(not specified)'}
Audience cue: ${audienceLine || '(not specified)'}

Current value:
"""
${currentValue}
"""

Rewrite this field once. Return ONLY the JSON object.`;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: 'enabled', budget_tokens: 1000 },
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

    const rewritten = parseRewritten(text);
    return NextResponse.json({ rewritten });
  } catch (error) {
    console.error('[rewrite-field] generation failed', error);
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

function parseRewritten(text: string): string {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('rewrite-field: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  const value = parsed.rewritten;
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('rewrite-field: model response missing the "rewritten" field');
  }
  return value.trim();
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
