// =============================================================================
// POST /api/edit-sections — the Bolt/Lovable-style AI edit bar's server half.
//
// Body: {
//   instruction: string,            // the operator's natural-language ask
//   container: 'page' | 'funnelStep',
//   sections: [{ id, type, enabled, data }],   // the surface being edited
//   selectedSectionId?: string | null,         // editor selection, if any
//   brand?: { businessName?, industryCategory?, audienceLine?,
//             voice?: { formality, urgency, technicality } },
// }
//
// Response: { operations: AIEditOperation[], summary: string }
//
// The route does NOT apply the operations — the browser does
// (`applyEditOperations` in lib/website/ai-edit.ts), because section
// defaults (`defaultData()`) live in the 'use client' section modules and
// must seed any added section. The route's job is the Claude call + strict
// validation of the returned ops: every referenced section id must exist,
// added types must be implemented + allowed in the container, and every
// update/add payload runs through `validateEnums` so an out-of-catalog
// variant value never reaches the editor.
//
// Sonnet 4.6 (an edit is targeted, not whole-page generation — the Opus
// tier is reserved for full-page/funnel generation per the parked model-
// choice decision). enabled+budget thinking; max_tokens > budget_tokens.
//
// Fallback policy mirrors /api/enhance-field:
//   503 (key unset)  → caller throws AppError.validation;
//   400 (bad body)   → caller surfaces the validation error;
//   500 (real fail)  → caller throws AppError.unexpected with the body.
//
// generation_log: not written — the route carries a client SLUG at best
// (generation_log.client_id is a NOT NULL uuid). Failures land in console +
// the 500 detail, matching the enhance-field / generate-seo precedent.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import { checkAndRecord } from '@/lib/rate-limit';
import {
  SHARED_FIELD_NOTES,
  formatSectionShape,
  voiceToneToProse,
} from '@/lib/website/generation-prompt';
import { validateEnums } from '@/lib/website/generation-validation';
import { SECTION_REGISTRY_META } from '@/lib/website/sections/registry-meta';
import type { SectionType, VoiceTone } from '@/lib/website/types';

export const maxDuration = 120;

const MODEL = 'claude-sonnet-4-6';

function callerIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/** Hard cap on operations per response — an edit instruction that legitimately
 *  touches more than this is really a regeneration, and an unbounded list is
 *  a runaway-model guard. */
const MAX_OPERATIONS = 12;

const SYSTEM_PROMPT = `You are the AI editor inside a website + funnel builder for local service businesses (electricians, plumbers, cleaners…). The operator is looking at a page made of typed sections and has typed an instruction — "make the hero more premium", "add an FAQ about gutter cleaning", "rewrite for Dublin instead of Cork". You return a SHORT list of operations that change only what the instruction asks for.

# Operations — the complete vocabulary

{ "op": "update", "sectionId": string, "fields": { ...partial data } }
  Merge the given fields over the section's existing data. Include ONLY the
  fields you are changing — untouched fields persist automatically. To change
  one headline, return one field.

{ "op": "add", "type": string, "afterSectionId": string | null, "fields": { ...data } }
  Insert a new section after the given section (null = end of page). Populate
  every COPY field with specific, on-brand content; omit LAYOUT fields unless
  the instruction requires a particular variation (defaults apply).

{ "op": "remove", "sectionId": string }
{ "op": "move", "sectionId": string, "toIndex": number }   // 0-based, position in the final order
{ "op": "toggle", "sectionId": string, "enabled": boolean }

# Rules

- Change the MINIMUM needed to satisfy the instruction. Do not "improve" sections the instruction didn't mention.
- Never change a section's "id" or "type" via update.
- Never output a "theme", "form", or "popup" field — those are managed outside this surface.
- Copy must be specific, benefit-led, locally grounded, in the brand voice provided. Never generic "Welcome to our website" filler.
- NEVER invent facts: no fabricated reviews, review counts, star ratings, certifications, "fully insured" claims, years in business, prices, or response times that are not already present in the existing sections or the brand context. Rewriting existing copy may carry existing facts forward; it may not mint new ones.
- Banned vocabulary: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning.
- If the instruction is ambiguous, take the most conservative reading and say what you assumed in the summary.
- If the instruction cannot be satisfied with these operations (e.g. it asks for a feature the section vocabulary doesn't have), return an empty operations array and explain why in the summary.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary:

{
  "operations": [ ...operations, in apply order... ],
  "summary": string   // one plain-English sentence describing what changed, e.g. "Rewrote the hero headline and sub for a more premium tone."
}`;

type IncomingSection = {
  id?: unknown;
  type?: unknown;
  enabled?: unknown;
  data?: unknown;
};

type EditSectionsRequest = {
  instruction?: unknown;
  container?: unknown;
  sections?: unknown;
  selectedSectionId?: unknown;
  brand?: {
    businessName?: unknown;
    industryCategory?: unknown;
    audienceLine?: unknown;
    voice?: unknown;
  };
};

type RawOperation = {
  op?: unknown;
  sectionId?: unknown;
  type?: unknown;
  afterSectionId?: unknown;
  fields?: unknown;
  toIndex?: unknown;
  enabled?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'generation-not-configured' }, { status: 503 });
  }

  // Same regen budget as /api/generate-seo — 10/IP/hour under
  // `ai_section_regen` (the edit bar IS section regeneration; see the
  // AI-generation rate-limits parked decision for the IP-vs-clientId story).
  const ip = callerIp(request);
  const decision = await checkAndRecord('ai_section_regen', { key: `edit:${ip}`, ip });
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

  let body: EditSectionsRequest;
  try {
    body = (await request.json()) as EditSectionsRequest;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const instruction = readString(body.instruction);
  const container = body.container === 'funnelStep' ? 'funnelStep' : 'page';
  const sections = readSections(body.sections);
  const selectedSectionId = readString(body.selectedSectionId) || null;

  if (!instruction || sections.length === 0) {
    return NextResponse.json(
      { error: 'missing-fields', detail: 'instruction and sections are required.' },
      { status: 400 },
    );
  }

  const presentTypes = new Set(sections.map((s) => s.type));
  const addableTypes = SECTION_REGISTRY_META.filter(
    (m) => m.implemented && m.allowedContainers.includes(container),
  ).map((m) => m.type);

  const catalogTypes = [...new Set([...presentTypes, ...addableTypes])] as SectionType[];
  const catalog = catalogTypes
    .map((t) => formatSectionShape(t))
    .filter(Boolean)
    .join('\n\n');

  const brand = body.brand ?? {};
  const voice = readVoice(brand.voice);
  const brandBlock = [
    `Business: ${readString(brand.businessName) || '(unnamed)'}`,
    `Industry: ${readString(brand.industryCategory) || '(not specified)'}`,
    `Audience: ${readString(brand.audienceLine) || '(not specified)'}`,
    voice ? `Voice: ${voiceToneToProse(voice)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const userMessage = [
    '## Brand context',
    brandBlock,
    '',
    '## Section vocabulary (types you may add: ' + addableTypes.join(', ') + ')',
    catalog,
    '',
    SHARED_FIELD_NOTES,
    '',
    '## Current sections (in page order)',
    JSON.stringify(
      sections.map((s, i) => ({ index: i, ...s })),
      null,
      2,
    ),
    '',
    selectedSectionId
      ? `## Editor selection\nThe operator currently has section "${selectedSectionId}" selected — an ambiguous instruction ("make this punchier") refers to it.`
      : null,
    '',
    '## Instruction',
    instruction,
    '',
    'Return ONLY the JSON object.',
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'enabled', budget_tokens: 3000 },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    const parsed = parseModelResponse(text);
    const validated = validateOperations(parsed.operations, sections, container);
    return NextResponse.json({ operations: validated, summary: parsed.summary });
  } catch (error) {
    console.error('[edit-sections] generation failed', error);
    const detail = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : 'Error';
    const status =
      typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : undefined;
    return NextResponse.json({ error: 'generation-failed', name, status, detail }, { status: 500 });
  }
}

// -- Parsing + validation ----------------------------------------------------

function parseModelResponse(text: string): {
  operations: RawOperation[];
  summary: string;
} {
  let raw = text.trim();
  if (raw.startsWith('```')) {
    raw = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('edit-sections: model response contained no JSON object');
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  const operations = Array.isArray(parsed.operations) ? (parsed.operations as RawOperation[]) : [];
  const summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : 'AI edit proposal.';
  return { operations, summary };
}

/** Strict server-side validation. Bad operations are DROPPED (not errors) —
 *  one out-of-vocabulary op shouldn't void the rest of an otherwise-good
 *  proposal; an empty validated list reads as "no changes" client-side. */
function validateOperations(
  raw: RawOperation[],
  sections: { id: string; type: SectionType }[],
  container: 'page' | 'funnelStep',
): Record<string, unknown>[] {
  const ids = new Set(sections.map((s) => s.id));
  const typeById = new Map(sections.map((s) => [s.id, s.type]));
  const addable = new Set(
    SECTION_REGISTRY_META.filter(
      (m) => m.implemented && m.allowedContainers.includes(container),
    ).map((m) => m.type),
  );
  // Envelope-managed keys the model is told never to touch — strip as
  // defence in depth.
  const FORBIDDEN_FIELDS = new Set(['theme', 'form', 'popup', 'id', 'type']);

  const out: Record<string, unknown>[] = [];
  for (const op of raw.slice(0, MAX_OPERATIONS)) {
    if (op.op === 'update') {
      const sectionId = readString(op.sectionId);
      const type = typeById.get(sectionId);
      if (!type || !isRecord(op.fields)) continue;
      const fields = stripKeys(op.fields, FORBIDDEN_FIELDS);
      if (Object.keys(fields).length === 0) continue;
      // Enum-validate just the patched keys — validateEnums substitutes any
      // out-of-catalog variant value with the catalog's first listed value.
      const { data } = validateEnums(type, fields);
      out.push({ op: 'update', sectionId, fields: data });
    } else if (op.op === 'add') {
      const type = readString(op.type) as SectionType;
      if (!addable.has(type)) continue;
      const fields = isRecord(op.fields) ? stripKeys(op.fields, FORBIDDEN_FIELDS) : {};
      const { data } = validateEnums(type, fields);
      const after = readString(op.afterSectionId);
      out.push({
        op: 'add',
        type,
        afterSectionId: ids.has(after) ? after : null,
        fields: data,
      });
    } else if (op.op === 'remove') {
      const sectionId = readString(op.sectionId);
      if (!ids.has(sectionId)) continue;
      out.push({ op: 'remove', sectionId });
    } else if (op.op === 'move') {
      const sectionId = readString(op.sectionId);
      const toIndex = typeof op.toIndex === 'number' ? Math.trunc(op.toIndex) : NaN;
      if (!ids.has(sectionId) || Number.isNaN(toIndex) || toIndex < 0) continue;
      out.push({ op: 'move', sectionId, toIndex });
    } else if (op.op === 'toggle') {
      const sectionId = readString(op.sectionId);
      if (!ids.has(sectionId) || typeof op.enabled !== 'boolean') continue;
      out.push({ op: 'toggle', sectionId, enabled: op.enabled });
    }
  }
  return out;
}

// -- Readers ------------------------------------------------------------------

function readString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stripKeys(
  record: Record<string, unknown>,
  forbidden: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!forbidden.has(key)) out[key] = value;
  }
  return out;
}

function readVoice(v: unknown): VoiceTone | null {
  if (!isRecord(v)) return null;
  const { formality, urgency, technicality } = v as Record<string, unknown>;
  if (
    typeof formality !== 'number' ||
    typeof urgency !== 'number' ||
    typeof technicality !== 'number'
  ) {
    return null;
  }
  return { formality, urgency, technicality } as VoiceTone;
}

function readSections(
  v: unknown,
): { id: string; type: SectionType; enabled: boolean; data: Record<string, unknown> }[] {
  if (!Array.isArray(v)) return [];
  const known = new Set(SECTION_REGISTRY_META.map((m) => m.type));
  const out: { id: string; type: SectionType; enabled: boolean; data: Record<string, unknown> }[] =
    [];
  for (const item of v as IncomingSection[]) {
    const id = readString(item.id);
    const type = readString(item.type) as SectionType;
    if (!id || !known.has(type)) continue;
    out.push({
      id,
      type,
      enabled: item.enabled !== false,
      data: isRecord(item.data) ? item.data : {},
    });
  }
  return out;
}
