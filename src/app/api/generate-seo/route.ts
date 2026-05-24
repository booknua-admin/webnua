// =============================================================================
// POST /api/generate-seo — the real Claude-backed SEO metadata generator.
//
// Body: { business: { name, industry?, audience? },
//         targets: { id, label, kind, text }[] }
// Response: { results: { [id]: { title, description } } } — one entry per
// target, mirroring what generateSeoSync produces so the client can swap the
// stub for this transparently.
//
// The browser reaches this through seo-generate.ts's `generateSeo`, which
// falls back to the deterministic generator if this route is unconfigured
// (no ANTHROPIC_API_KEY) or fails. The Anthropic API key stays server-side.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import { checkAndRecord } from '@/lib/rate-limit';

function callerIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export const maxDuration = 120;

const MODEL = 'claude-opus-4-7';

const SYSTEM_PROMPT = `You are an SEO specialist writing meta titles and descriptions for small service-business websites (trades like electricians, plumbers, cleaners, locksmiths, landscapers).

For each target you are given the page label, the page kind, and a blob of the page's own copy. Write the page's meta title and meta description.

Rules:
- title: 50-60 characters. Lead with the page's value to the customer, include the business name, no clickbait, no ALL CAPS.
- description: 140-158 characters. One or two plain sentences naming the customer outcome plus a concrete reason to click (a guarantee, a timeframe, the service area). No vague filler — no "quality you can trust", no "we go the extra mile".
- Write from the page's actual copy. Never invent facts, prices, or claims that are not in the provided text.

Return ONLY a single JSON object, no markdown fences and no commentary, in exactly this shape:
{ "results": { "<target id>": { "title": string, "description": string } } }
Include one entry for every target id provided.`;

type TargetIn = { id?: unknown; label?: unknown; kind?: unknown; text?: unknown };

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Not an error — the client falls back to the deterministic generator.
    return NextResponse.json(
      { error: 'generation-not-configured' },
      { status: 503 },
    );
  }

  // Pattern B section-regen rate limit — 10/IP/hour. The route doesn't
  // carry a clientId today, so we key on caller IP. A real per-workspace
  // limit lands in a follow-up that threads clientId through the browser
  // caller; the IP variant still closes the abuse vector (a single user
  // can't burn 100 regens in a minute by Cmd-R holding).
  const ip = callerIp(request);
  const decision = await checkAndRecord('ai_section_regen', { key: `seo:${ip}`, ip });
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'rate-limited', detail: decision.message, retryAfterSeconds: decision.retryAfterSeconds },
      { status: 429 },
    );
  }

  let body: { business?: unknown; targets?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const targets = Array.isArray(body.targets)
    ? (body.targets as TargetIn[]).filter((t) => typeof t.id === 'string')
    : [];
  if (targets.length === 0) {
    return NextResponse.json({ error: 'no-targets' }, { status: 400 });
  }

  const userMessage = `Business: ${JSON.stringify(body.business ?? {})}

Targets:
${JSON.stringify(targets, null, 2)}`;

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
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

    return NextResponse.json(parseResults(text));
  } catch (error) {
    console.error('[generate-seo] generation failed', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'generation-failed', detail },
      { status: 500 },
    );
  }
}

/** Extract the `{ results: {...} }` object — tolerant of stray markdown
 *  fences or leading/trailing prose. */
function parseResults(text: string): { results: Record<string, unknown> } {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('generate-seo: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
  if (
    parsed &&
    typeof parsed === 'object' &&
    'results' in parsed &&
    typeof (parsed as { results: unknown }).results === 'object'
  ) {
    return parsed as { results: Record<string, unknown> };
  }
  // The model returned the id→draft map at the top level — accept it.
  if (parsed && typeof parsed === 'object') {
    return { results: parsed as Record<string, unknown> };
  }
  throw new Error('generate-seo: model response was not a JSON object');
}
