// =============================================================================
// POST /api/integrations/meta_ads/generate-angles
//
// Phase 7.5 · Session 2.1. The magic-moment backbone: ONE Sonnet call
// returns three differentiated ad angles (pain-led, outcome-led,
// trust-led) for the customer's offer + brand. The Generate surface
// renders the angles as cards; the operator picks 1-3 and launches.
//
// Operator-only (campaign generation is operator governance). Auth via
// requireOperatorForClient.
//
// Body:
//   { clientId: string }
//
// Server reads the entire brief from the DB itself (brands + clients +
// website hero copy) — no operator-typed input. This is the magic
// moment: the operator clicks one button, everything else flows from
// what we already know.
//
// Response:
//   200 → { angles: GeneratedAngle[] }
//   400 → { error }
//   403 → { error: 'forbidden' | 'forbidden-client' }
//   429 → { error: 'rate-limited', detail, retryAfterSeconds }
//   503 → { error: 'anthropic-not-configured' }
//   500 → { error: 'angle-generation-failed', name, status?, detail? }
//
// Model: Sonnet 4.6. Same choice as creative-draft.ts — short structured
// copy doesn't need Opus. Anthropic constraint: thinking.enabled +
// budget_tokens with max_tokens > budget_tokens; we use budget=3000,
// max=6000 (three-angle output is ~2-3x the variant-drafter output).
//
// Rate limit: ai_angles_gen — 3/client/24h. Same shape as ai_site_gen /
// ai_funnel_gen. Manual regenerate is the same call so the cap applies.
//
// Observability: missing-angle gaps (Sonnet returned 2 instead of 3)
// log to console for V1. Matches the /api/generate-offer +
// /api/enhance-offer precedent — generation_log's section_type column
// is constrained to the website section_type enum and adding
// 'meta_angle' would need a new migration (out of scope this session).
// Promote to a dedicated table or enum extension when angle telemetry
// becomes operationally important.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { checkAndRecord } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase/server';
import { templateForIndustry } from '@/lib/integrations/meta-ads/templates';

export const maxDuration = 120;

const MODEL = 'claude-sonnet-4-6';

// Meta News Feed limits — same defence-in-depth as creative-draft.ts.
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

type AngleId = 'pain' | 'outcome' | 'trust';

type GeneratedAngle = {
  id: AngleId;
  label: string;
  rationale: string;
  variants: CreativeVariant[];
  suggestedCtaType: CtaType;
};

const ANGLE_LABEL: Record<AngleId, string> = {
  pain: 'Pain-led',
  outcome: 'Outcome-led',
  trust: 'Trust-led',
};

// --- system prompt ---------------------------------------------------------

const SYSTEM_PROMPT = `You are a direct-response copywriter in the Suby / Sultanic tradition, writing Facebook + Instagram lead-generation ads for local service businesses (electricians, plumbers, cleaners, landscapers, roofers, painters, locksmiths, handymen, carpenters, HVAC).

You will be given a customer's brand + offer + audience + services. You write THREE distinct ad ANGLES (not three worded-differently versions of the same pitch — three genuinely different framings of the offer). The operator picks 1-3 to launch in parallel.

# The three angles you MUST return

You return exactly three angles, in this order: pain → outcome → trust. Each angle is a complete mini-campaign.

1. PAIN-LED — Lead with the customer's worst-case moment. "Burst pipe at 9pm?" "Switchboard sparking?" "Tired of cleaners who don't show up?" Works best for emergency / time-sensitive trades. The hook is the moment they realise they have a problem.

2. OUTCOME-LED — Lead with the after-state. "Sleep in a clean house this weekend." "Your power back on by tonight." "A garden you can actually use." Works best for lifestyle / scheduled-comfort services. The hook is the feeling they get after the job is done.

3. TRUST-LED — Lead with credibility signals. "15 years on the tools. Same-day fixed quotes." "Local · Licensed · 800+ jobs done." Works best for high-trust / high-stakes trades and repeat-purchase services. The hook is "you can trust us with your home/money/safety". CRITICAL: only use specific numbers (years, jobs, percentages, ratings) if they are in the brief. If the brief has no specifics, lean on qualitative credibility ("local", "fully licensed", "fixed-price quotes — no surprises").

# Per-angle output shape

Each angle has:
- "rationale": ONE sentence explaining WHY this angle for THIS customer. Operator-facing — written so the operator picks informed. Reference what's actually in the brief.
- "variants": TWO copy variants tuned to the angle. Each variant is the full Meta ad shape: headline / primaryText / description / ctaType. The two variants should be slightly different attacks on the same angle (different opening word, different pain-point or outcome detail) — but still recognisably the SAME angle.
- "suggestedCtaType": The angle-level CTA recommendation. The operator's variant cards may carry per-variant CTAs that differ.

# Meta ad fields (per variant)

## primaryText (≤ 125 characters)
Open with a SPECIFIC pain / outcome / trust hook (matching the angle). Deliver the offer. End with a soft trigger.
Good (pain): "Burst pipe and you're already standing in water? Mark's on the road within 2 hours, 7 days a week. Local Cottesloe plumber."
Good (outcome): "Walk into a spotless kitchen this Friday evening. Fortnightly cleans from €99 — vetted, insured, on time."
Good (trust): "15 years on the tools, 800+ Perth jobs done. Fixed-price quotes — no surprises on the invoice."
Bad: "We provide premium plumbing services to discerning clients." (every banned word, no specifics)

## headline (≤ 40 characters)
A short outcome statement OR a sharp pain question OR a credibility line — matching the angle. Bold and direct.
Good (pain): "Burst pipe? Sorted in 2 hours."
Good (outcome): "Clean home, Friday night."
Good (trust): "Cottesloe · 15 years · Licensed"
Bad: "Quality Plumbing Services" / "Welcome to ACME"

## description (≤ 27 characters)
3-5 proof points separated by · or one short trust phrase.
Good: "Local · Licensed · 24/7"
Bad: "We are passionate about service"

## ctaType
Pick the button that matches the angle:
- "BOOK_NOW" — for direct-booking offers (cleaners, regular services)
- "GET_QUOTE" — for trades that quote per job (most plumbers, electricians, roofers, carpenters, landscapers)
- "CONTACT_US" — for urgency-first angles ("call us, we move") — locksmiths, emergency callouts
- "LEARN_MORE" — fallback when the offer needs explanation
- "GET_OFFER" — for promotion-led offers ("Free first clean")
- "APPLY_NOW" — almost never use; not lead-gen-shaped
- "SIGN_UP" — almost never use for trades

# Hard bans

NEVER use any of: "comprehensive", "discerning", "trusted partner", "cutting-edge", "premium quality", "elevate", "transform", "solutions", "best-in-class", "world-class", "industry-leading", "innovative", "seamless", "robust", "leverage", "synergy", "passionate", "dedicated team". These signal AI copy and tank conversion.

NEVER invent: prices not in the brief, response times not in the brief, certifications not in the brief, percentages not in the brief, customer counts not in the brief, ratings not in the brief. If the brief doesn't carry a specific number, use qualitative language ("fast", "local", "fully licensed") — never invent specifics.

NEVER write all three angles with the same opening word, same pain-point, or same proof-point set. The operator should be able to tell they're looking at three different ads at a glance.

# Output

Return ONLY a JSON object of this shape:

{
  "angles": [
    {
      "id": "pain",
      "rationale": "...",
      "variants": [
        { "headline": "...", "primaryText": "...", "description": "...", "ctaType": "..." },
        { "headline": "...", "primaryText": "...", "description": "...", "ctaType": "..." }
      ],
      "suggestedCtaType": "..."
    },
    { "id": "outcome", "rationale": "...", "variants": [...], "suggestedCtaType": "..." },
    { "id": "trust",   "rationale": "...", "variants": [...], "suggestedCtaType": "..." }
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

  // Rate limit — same shape as ai_site_gen / ai_funnel_gen. The check
  // happens AFTER auth so a forbidden caller doesn't consume quota.
  const decision = await checkAndRecord('ai_angles_gen', {
    key: clientId,
    clientId,
  });
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

  // Resolve the brief from the DB — service-role read because every
  // field we care about lives across brands + clients + website_versions,
  // and the operator route already authenticated the caller; running
  // through the operator's token would still resolve the same rows.
  const brief = await loadBrief(clientId);

  let response;
  try {
    response = await callClaude(brief);
  } catch (error) {
    const e = error as { name?: string; status?: number; message?: string };
    return NextResponse.json(
      {
        error: 'angle-generation-failed',
        name: e.name ?? 'unknown',
        status: e.status,
        detail: e.message,
      },
      { status: 500 },
    );
  }
  const text = extractText(response);
  const parsed = parseAngles(text);
  if (!parsed || parsed.length === 0) {
    return NextResponse.json(
      {
        error: 'angle-generation-failed',
        name: 'invalid-output',
        detail: 'Sonnet returned no parseable angles.',
      },
      { status: 500 },
    );
  }

  // Clip every variant defensively. Note any angle Sonnet failed to
  // return — console only for V1 (see header comment for the rationale).
  const clipped = parsed.map(clipAngleToMetaLimits);
  logMissingAngles(clientId, clipped);

  return NextResponse.json({ angles: clipped });
}

// --- brief resolution ------------------------------------------------------

type Brief = {
  businessName: string;
  serviceArea: string;
  industry: string;
  offer: {
    headline: string;
    promise: string;
    riskReversal: string;
    ctaText: string;
  } | null;
  services: string[];
  audienceLine: string;
  brandTagline: string;
  voiceFormality: number;
  voiceUrgency: number;
  voiceTechnicality: number;
  websiteHeroCopy: string;
};

async function loadBrief(clientId: string): Promise<Brief> {
  const svc = getServiceClient();
  const [brandRes, clientRes, websiteRes] = await Promise.all([
    svc
      .from('brands')
      .select(
        'audience_line, services, top_jobs_to_be_booked, offer, tagline, voice_formality, voice_urgency, voice_technicality, industry_category',
      )
      .eq('client_id', clientId)
      .maybeSingle(),
    svc
      .from('clients')
      .select('name, industry, service_area')
      .eq('id', clientId)
      .maybeSingle(),
    svc
      .from('websites')
      .select('published_version_id')
      .eq('client_id', clientId)
      .maybeSingle(),
  ]);
  const brand = (brandRes.data ?? null) as {
    audience_line?: string | null;
    services?: string[] | null;
    top_jobs_to_be_booked?: string[] | null;
    offer?: unknown;
    tagline?: string | null;
    voice_formality?: number | null;
    voice_urgency?: number | null;
    voice_technicality?: number | null;
    industry_category?: string | null;
  } | null;
  const client = (clientRes.data ?? null) as {
    name?: string | null;
    industry?: string | null;
    service_area?: string | null;
  } | null;
  const websiteRow = (websiteRes.data ?? null) as {
    published_version_id?: string | null;
  } | null;

  let websiteHeroCopy = '';
  if (websiteRow?.published_version_id) {
    const versionRes = await svc
      .from('website_versions')
      .select('snapshot')
      .eq('id', websiteRow.published_version_id)
      .maybeSingle();
    websiteHeroCopy = extractHomeHeroCopy(
      (versionRes.data as { snapshot?: unknown } | null)?.snapshot,
    );
  }

  const services =
    (brand?.services && brand.services.length > 0
      ? brand.services
      : brand?.top_jobs_to_be_booked) ?? [];

  return {
    businessName: client?.name ?? 'this business',
    serviceArea: client?.service_area ?? 'the local area',
    industry: brand?.industry_category ?? client?.industry ?? 'generic',
    offer: parseOffer(brand?.offer),
    services: services.slice(0, 12),
    audienceLine: brand?.audience_line?.trim() ?? '',
    brandTagline: brand?.tagline?.trim() ?? '',
    voiceFormality: clampVoice(brand?.voice_formality),
    voiceUrgency: clampVoice(brand?.voice_urgency),
    voiceTechnicality: clampVoice(brand?.voice_technicality),
    websiteHeroCopy,
  };
}

function parseOffer(value: unknown): Brief['offer'] {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const headline = typeof o.headline === 'string' ? o.headline : '';
  const promise = typeof o.promise === 'string' ? o.promise : '';
  if (headline.length === 0 && promise.length === 0) return null;
  return {
    headline,
    promise,
    riskReversal: typeof o.risk_reversal === 'string' ? o.risk_reversal : '',
    ctaText: typeof o.cta_text === 'string' ? o.cta_text : '',
  };
}

function clampVoice(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

/** Walk the published version snapshot to find the home page's hero —
 *  joined with `·` so the prompt sees the customer's own positioning
 *  language. Mirrors the helper in LaunchCampaignWizard. */
function extractHomeHeroCopy(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const pages = (snapshot as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return '';
  const homePage =
    pages.find(
      (p): p is { sections?: unknown[] } =>
        p != null &&
        typeof p === 'object' &&
        (p as { type?: unknown }).type === 'home',
    ) ?? (pages[0] as { sections?: unknown[] } | undefined);
  const sections = homePage?.sections;
  if (!Array.isArray(sections)) return '';
  const heroSection = sections.find(
    (s): s is { data?: Record<string, unknown> } =>
      s != null && typeof s === 'object' && (s as { type?: unknown }).type === 'hero',
  );
  const data = heroSection?.data;
  if (!data) return '';
  const parts = ['eyebrow', 'headline', 'sub']
    .map((k) => {
      const v = data[k];
      return typeof v === 'string' ? v.trim() : '';
    })
    .filter((s) => s.length > 0);
  return parts.join(' · ');
}

// --- claude call ------------------------------------------------------------

async function callClaude(brief: Brief) {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const template = templateForIndustry(brief.industry);
  const voiceLine = describeVoice(
    brief.voiceFormality,
    brief.voiceUrgency,
    brief.voiceTechnicality,
  );
  const servicesLine =
    brief.services.length > 0
      ? brief.services.map((s) => `- ${s}`).join('\n')
      : '(none listed — use generic trade language; do not invent specific service names)';

  const offerBlock = brief.offer
    ? `Headline: "${brief.offer.headline}"
Promise: "${brief.offer.promise}"
Risk-reversal: "${brief.offer.riskReversal || '(none on file)'}"
CTA text: "${brief.offer.ctaText || '(none on file)'}"`
    : `(no captured offer — draft a qualitative promise from the audience + services. Do NOT invent prices, response times, or other specifics.)`;

  const heroBlock = brief.websiteHeroCopy
    ? `# Their published site's positioning (lift voice + framing from this — do NOT copy verbatim)\n\n${brief.websiteHeroCopy}`
    : '';
  const audienceBlock = brief.audienceLine
    ? `Their audience: ${brief.audienceLine}`
    : '(no audience line on file — write for a broad local-services audience)';
  const taglineBlock = brief.brandTagline
    ? `Their tagline: "${brief.brandTagline}"`
    : '';

  const userMessage = `# Context

Business name: ${brief.businessName}
Service area: ${brief.serviceArea}
Industry: ${template.label}
Template default CTA: ${template.copyTemplates.ctaType}
Brand voice: ${voiceLine}
${audienceBlock}
${taglineBlock}

# Their services

${servicesLine}

${heroBlock}

# The offer to sell

${offerBlock}

# Output

Return exactly three angles in the locked JSON shape from the system prompt, in this order: pain, outcome, trust. Each angle's rationale should reference something concrete from the context above (their industry, their services, their audience, their offer) — not generic copywriter talk. Each angle should carry TWO variants.

JSON only.`;

  return anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    thinking: { type: 'enabled', budget_tokens: 3000 },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
}

function describeVoice(
  formality: number,
  urgency: number,
  technicality: number,
): string {
  const parts: string[] = [];
  if (formality <= 2) parts.push('casual + warm (skip the trade jargon, feel like a neighbour)');
  else if (formality >= 4) parts.push('professional + measured (more formal register)');
  else parts.push('friendly-professional (default register)');
  if (urgency <= 2) parts.push('calm, no-pressure');
  else if (urgency >= 4) parts.push('high-urgency (act-now framing where the offer supports it)');
  else parts.push('moderate urgency (specific timeframe, no shouting)');
  if (technicality <= 2) parts.push('plain English (no industry terms)');
  else if (technicality >= 4) parts.push('comfortable with industry terms (the customer already knows the trade)');
  return parts.join(' · ');
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

// --- parsing ----------------------------------------------------------------

function parseAngles(text: string): GeneratedAngle[] | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const angles = (parsed as { angles?: unknown }).angles;
  if (!Array.isArray(angles)) return null;
  const result: GeneratedAngle[] = [];
  for (const a of angles) {
    const angle = parseAngle(a);
    if (angle) result.push(angle);
  }
  // Ensure the response covers all three ids. If Sonnet skipped one,
  // we still return what we got — the generation_log entry below
  // captures the gap for audit.
  return result;
}

function parseAngle(value: unknown): GeneratedAngle | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const id = v.id;
  if (id !== 'pain' && id !== 'outcome' && id !== 'trust') return null;
  const rationale = typeof v.rationale === 'string' ? v.rationale.trim() : '';
  const suggestedRaw =
    typeof v.suggestedCtaType === 'string' ? v.suggestedCtaType : '';
  const suggested: CtaType = (CTA_VOCAB as readonly string[]).includes(
    suggestedRaw,
  )
    ? (suggestedRaw as CtaType)
    : 'LEARN_MORE';
  const variantsRaw = Array.isArray(v.variants) ? v.variants : [];
  const variants: CreativeVariant[] = [];
  for (const vv of variantsRaw) {
    if (!vv || typeof vv !== 'object') continue;
    const o = vv as Record<string, unknown>;
    const headline = typeof o.headline === 'string' ? o.headline.trim() : '';
    const primaryText =
      typeof o.primaryText === 'string' ? o.primaryText.trim() : '';
    const description =
      typeof o.description === 'string' ? o.description.trim() : '';
    const ctaRaw = typeof o.ctaType === 'string' ? o.ctaType : suggested;
    const cta: CtaType = (CTA_VOCAB as readonly string[]).includes(ctaRaw)
      ? (ctaRaw as CtaType)
      : suggested;
    if (headline.length === 0 || primaryText.length === 0) continue;
    variants.push({ headline, primaryText, description, ctaType: cta });
  }
  if (variants.length === 0 || rationale.length === 0) return null;
  return {
    id,
    label: ANGLE_LABEL[id],
    rationale,
    variants,
    suggestedCtaType: suggested,
  };
}

function clipAngleToMetaLimits(a: GeneratedAngle): GeneratedAngle {
  return {
    ...a,
    variants: a.variants.map(clipVariantToMetaLimits),
  };
}

function clipVariantToMetaLimits(v: CreativeVariant): CreativeVariant {
  return {
    headline: clipText(v.headline, HEADLINE_MAX),
    primaryText: clipText(v.primaryText, PRIMARY_TEXT_MAX),
    description: clipText(v.description, DESCRIPTION_MAX),
    ctaType: v.ctaType,
  };
}

function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > max * 0.6) {
    return slice.slice(0, lastSpace).replace(/[,\.;:!\-]+$/, '');
  }
  return slice;
}

// --- observability ---------------------------------------------------------

/** Note the angles Sonnet skipped (e.g. returned 2 instead of 3). Console
 *  only for V1 — generation_log's section_type enum doesn't carry a
 *  'meta_angle' value and adding one is its own migration. Promote to a
 *  table when angle telemetry becomes operationally important. */
function logMissingAngles(
  clientId: string,
  returnedAngles: GeneratedAngle[],
): void {
  const expected: AngleId[] = ['pain', 'outcome', 'trust'];
  const have = new Set(returnedAngles.map((a) => a.id));
  const missing = expected.filter((id) => !have.has(id));
  if (missing.length === 0) return;
  console.warn(
    `[generate-angles] Sonnet skipped angle(s) for client=${clientId}: ${missing.join(', ')}`,
  );
}
