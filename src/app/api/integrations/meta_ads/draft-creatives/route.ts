// =============================================================================
// POST /api/integrations/meta_ads/draft-creatives
//
// Phase 7.5 Session 1. Sonnet-backed generator of N ad creative variants
// for the launch wizard's step 4. Operator types the customer's offer;
// the route returns 3 variants of (headline, primaryText, description,
// ctaType) tuned to the brand voice + industry.
//
// Operator-only (campaign creation is operator governance). Auth via
// requireOperatorForClient.
//
// Body:
//   {
//     clientId: string,         // for auth + brief-context resolution
//     offer: string,            // the customer's offer (operator input)
//     templateSlug: string,     // industry — picks the template copy shape
//     businessName: string,     // for substitution
//     serviceArea: string,      // for substitution
//     count?: number,           // default 3, max 5
//   }
//
// Response:
//   200 → { variants: Array<{ headline, primaryText, description, ctaType }> }
//   400 → { error }
//   403 → { error: 'forbidden' | 'forbidden-client' }
//   503 → { error: 'anthropic-not-configured' }
//   500 → { error: 'draft-failed', name, status?, detail? }
//
// Fallback policy: 503 when ANTHROPIC_API_KEY is unset (caller throws —
// the whole point of step 4 is real AI-drafted copy; the template's
// default copy is the deterministic fallback the operator can use
// instead). 500 on real failure surfaces in the wizard.
//
// generation_log: not written here — same precedent as /api/generate-offer.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import {
  type MetaAdTemplate,
  templateForIndustry,
} from '@/lib/integrations/meta-ads/templates';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

// Meta News Feed limits (Meta drifts these — values are conservative
// enough that any real placement renders without truncation).
const HEADLINE_MAX = 40;
const PRIMARY_TEXT_MAX = 125;
const DESCRIPTION_MAX = 27;

const CTA_VOCAB = [
  'LEARN_MORE',
  'BOOK_NOW',
  'GET_QUOTE',
  'CONTACT_US',
  'SIGN_UP',
  'GET_OFFER',
  'APPLY_NOW',
] as const;

type CtaType = (typeof CTA_VOCAB)[number];

type CreativeVariant = {
  headline: string;
  primaryText: string;
  description: string;
  ctaType: CtaType;
};

const SYSTEM_PROMPT = `You are a direct-response copywriter in the Suby / Sultanic tradition, writing Facebook + Instagram lead-generation ads for local service businesses (electricians, plumbers, cleaners, landscapers, roofers, painters, locksmiths, handymen, carpenters, HVAC).

You will be given ONE offer the business owner wants to run, plus their industry, service area, business name, and brand voice. You write THREE distinct ad creative variants that all sell the same offer — each from a different angle so the operator can pick the strongest one. Then they launch.

# What the customer is looking at

A Facebook News Feed scrolling past at speed. They are not browsing for the customer's business — they are scrolling through friends' posts. The ad has 1.5 seconds to make them stop. That is the whole job.

The shape is fixed by Meta:

1. PRIMARY TEXT (up to 125 characters) — the text above the image. First thing the eye lands on. This is the pain hook + the promise. Most important field.
2. IMAGE — already chosen, not your job.
3. HEADLINE (up to 40 characters) — bold caption under the image. Names the outcome the customer wants.
4. DESCRIPTION (up to 27 characters) — small line under the headline. Reinforces trust, names a proof point ("Local · Insured"), or extends the headline by one beat.
5. CTA BUTTON — one of: LEARN_MORE, BOOK_NOW, GET_QUOTE, CONTACT_US, SIGN_UP, GET_OFFER, APPLY_NOW.

# How to write each field

## primaryText (≤ 125 characters)
Open with a SPECIFIC pain or moment. "Burst pipe at 9pm?" "Switchboard sparking?" "Tired of cleaners who don't turn up?" Then deliver the offer in one line. End with a soft trigger ("Free quote in minutes.").
Good: "Burst pipe and you're already standing in water? Mark's on the road within 2 hours, 7 days a week. Local Cottesloe plumber."
Bad: "We provide premium plumbing services to discerning clients in the Perth area." (every banned word)

## headline (≤ 40 characters)
A short outcome statement OR a sharp pain question. Bold and direct.
Good: "Burst pipe? Sorted in 2 hours."
Good: "Switchboard issues? We're local."
Bad: "Quality Plumbing Services" / "Welcome to ACME"

## description (≤ 27 characters)
3-5 proof points separated by · or one short trust phrase.
Good: "Local · Licensed · 24/7"
Good: "Fixed-price quotes, no surprises"
Bad: "We are passionate about service"

## ctaType
Pick the button that matches the offer's primary action:
- "BOOK_NOW" — for direct-booking offers (cleaners, regular services)
- "GET_QUOTE" — for trades that quote per job (most plumbers, electricians, roofers, carpenters, landscapers)
- "CONTACT_US" — for urgency ("call us, we move") — locksmiths, emergency callouts
- "LEARN_MORE" — fallback when the offer needs explanation
- "GET_OFFER" — for promotion-led offers ("Free first clean")
- "APPLY_NOW" — almost never use; not lead-gen-shaped
- "SIGN_UP" — almost never use for trades

# Variant strategy

Across the three variants, take three distinct angles. Pick three from:
- Pain-first ("Burst pipe at midnight?")
- Promise-first ("On site in 2 hours, 7 days a week")
- Trust-first ("Cottesloe's most-booked plumber" — only if backed by the brief)
- Reassurance-first ("No surprise pricing. Free quote. Local.")
- Outcome-first ("Your power's back on tonight")
The three variants should feel like different ads, NOT the same ad with synonyms swapped.

# Hard bans

NEVER use any of: "comprehensive", "discerning", "trusted partner", "cutting-edge", "premium quality", "elevate", "transform", "solutions", "best-in-class", "world-class", "industry-leading", "innovative", "seamless", "robust", "leverage", "synergy", "passionate", "dedicated team". These signal AI copy and tank conversion.

NEVER invent: prices not in the brief, response times not in the brief, certifications not in the brief, percentages not in the brief, customer counts not in the brief, ratings not in the brief. If the brief doesn't carry a specific number, use qualitative language ("fast", "local", "fully licensed") — never invent specifics.

# Output

Return ONLY a JSON object of this shape:

{
  "variants": [
    { "headline": "...", "primaryText": "...", "description": "...", "ctaType": "..." },
    { "headline": "...", "primaryText": "...", "description": "...", "ctaType": "..." },
    { "headline": "...", "primaryText": "...", "description": "...", "ctaType": "..." }
  ]
}

No commentary, no code fences, no explanation. JSON only.`;

// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'anthropic-not-configured' },
      { status: 503 },
    );
  }

  const offer = body.offer;
  if (typeof offer !== 'string' || offer.length === 0) {
    return NextResponse.json({ error: 'missing-offer' }, { status: 400 });
  }
  const templateSlug = body.templateSlug;
  if (typeof templateSlug !== 'string' || templateSlug.length === 0) {
    return NextResponse.json({ error: 'missing-templateSlug' }, { status: 400 });
  }
  const businessName =
    typeof body.businessName === 'string' ? body.businessName : 'this business';
  const serviceArea =
    typeof body.serviceArea === 'string' ? body.serviceArea : 'the local area';
  const count = Math.min(5, Math.max(1, Number(body.count) || 3));

  const template = templateForIndustry(templateSlug);

  let response;
  try {
    response = await callClaude({
      offer,
      template,
      businessName,
      serviceArea,
      count,
    });
  } catch (error) {
    const e = error as { name?: string; status?: number; message?: string };
    return NextResponse.json(
      {
        error: 'draft-failed',
        name: e.name ?? 'unknown',
        status: e.status,
        detail: e.message,
      },
      { status: 500 },
    );
  }
  const text = extractText(response);
  const parsed = parseVariants(text, count);
  if (!parsed) {
    return NextResponse.json(
      {
        error: 'draft-failed',
        name: 'invalid-output',
        detail: 'Sonnet returned no parseable variants.',
      },
      { status: 500 },
    );
  }

  const clipped = parsed.map(clipToMetaLimits);
  return NextResponse.json({ variants: clipped });
}

// --- claude call -------------------------------------------------------------

type CallInput = {
  offer: string;
  template: MetaAdTemplate;
  businessName: string;
  serviceArea: string;
  count: number;
};

async function callClaude(input: CallInput) {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const userMessage = `# Context

Business name: ${input.businessName}
Service area: ${input.serviceArea}
Industry: ${input.template.label}
Template's default CTA: ${input.template.copyTemplates.ctaType}

# The offer to sell

${input.offer.trim()}

# Output

Return exactly ${input.count} variants in the locked JSON shape from the system prompt. JSON only.`;

  return anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'enabled', budget_tokens: 2000 },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
}

function extractText(response: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();
}

// --- parsing -----------------------------------------------------------------

function parseVariants(text: string, count: number): CreativeVariant[] | null {
  // Strip code fences if Sonnet wrapped output in them.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const variants = (parsed as { variants?: unknown }).variants;
  if (!Array.isArray(variants)) return null;
  const valid: CreativeVariant[] = [];
  for (const v of variants) {
    if (!v || typeof v !== 'object') continue;
    const obj = v as Record<string, unknown>;
    const headline = typeof obj.headline === 'string' ? obj.headline.trim() : '';
    const primaryText =
      typeof obj.primaryText === 'string' ? obj.primaryText.trim() : '';
    const description =
      typeof obj.description === 'string' ? obj.description.trim() : '';
    const ctaRaw = typeof obj.ctaType === 'string' ? obj.ctaType : 'LEARN_MORE';
    const cta: CtaType = (CTA_VOCAB as readonly string[]).includes(ctaRaw)
      ? (ctaRaw as CtaType)
      : 'LEARN_MORE';
    if (headline.length === 0 || primaryText.length === 0) continue;
    valid.push({ headline, primaryText, description, ctaType: cta });
    if (valid.length >= count) break;
  }
  return valid.length > 0 ? valid : null;
}

/** Clip variants to Meta's text limits — defence in depth against Sonnet
 *  drift. Word-aware truncation when possible; otherwise hard-clip. */
function clipToMetaLimits(v: CreativeVariant): CreativeVariant {
  return {
    headline: clipText(v.headline, HEADLINE_MAX),
    primaryText: clipText(v.primaryText, PRIMARY_TEXT_MAX),
    description: clipText(v.description, DESCRIPTION_MAX),
    ctaType: v.ctaType,
  };
}

function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  // Prefer the last whole word that fits.
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > max * 0.6) {
    return slice.slice(0, lastSpace).replace(/[,\.;:!\-]+$/, '');
  }
  return slice;
}
