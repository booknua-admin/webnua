// =============================================================================
// POST /api/integrations/meta_ads/propose-brief-fills
//
// Phase 7.5 · Session 2.2. Called when the brief has soft-block gaps; the
// route does ONE Webnua AI call that drafts a proposed value for every
// missing field plus a one-line rationale, and the UI renders the
// proposals as editable cards the operator confirms (or edits) in a
// single pass.
//
// Operator-only. Auth via requireOperatorForClient.
//
// Body:
//   { clientId: string, missing: BriefField[] }
//
// Response:
//   200 → {
//     proposals: Array<{
//       field: 'offer' | 'audience_line' | 'services' | 'accent_color',
//       proposed: string,           // already-formatted ready-to-save
//                                   // value (services = comma-separated;
//                                   // accent_color = #hex)
//       rationale: string,          // ≤ 1 sentence, operator-facing
//     }>,
//   }
//   400 → { error }
//   403 → { error: 'forbidden' | 'forbidden-client' }
//   429 → { error: 'rate-limited', detail, retryAfterSeconds }
//   503 → { error: 'anthropic-not-configured' }
//   500 → { error: 'propose-failed', name, status?, detail? }
//
// Rate limit: shares the ai_angles_gen bucket so a generate + chat cycle
// doesn't double-bill the daily cap.
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import { env } from '@/lib/env';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { checkAndRecord } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase/server';
import { INDUSTRY_PRIMARY_COLORS } from '@/lib/onboarding/industry-colors';
import { mapIndustry } from '@/lib/website/industry-templates';

// Haiku 4.5 settles in ~1s; 15s ceiling covers network blips.
export const maxDuration = 15;

// Model: Haiku 4.5 — short structured output (4 strings + 4 rationales),
// no nuance needed. ~1s vs Sonnet's ~10s with thinking. Falls back to
// the deterministic fallbackProposal if Haiku returns blank fields,
// which is the same shape Sonnet's error path already used.
const MODEL = 'claude-haiku-4-5-20251001';

type BriefField = 'offer' | 'audience_line' | 'services' | 'accent_color';

const VALID_FIELDS: ReadonlySet<BriefField> = new Set([
  'offer',
  'audience_line',
  'services',
  'accent_color',
]);

type ProposedFill = {
  field: BriefField;
  proposed: string;
  rationale: string;
};

const SYSTEM_PROMPT = `You are filling brand-profile gaps for a local service business so an ad-generation pipeline has enough context to draft good ads.

You will receive what's already on file (business name, service area, industry, services list, audience line, offer, brand voice, hero copy from their published site) AND a list of fields the operator hasn't supplied yet. For each missing field, propose ONE concrete, on-brand value that the operator can either accept as-is or tweak in 5 seconds.

# Output rules per field

## "offer"
Propose a single short line — the promise the business would put on a billboard. Lift specifics from their services + audience + hero copy. Aim for 6-14 words. Do NOT invent prices, response times, customer counts, or certifications that aren't already in the brief.
Good: "Fixed-price quotes from a fully licensed local electrician."
Good: "Spotless homes, every fortnight — same cleaner, same time."
Bad: "Premium plumbing solutions for discerning clients." (banned corporate-speak)
Bad: "€99 emergency call-outs — call us 24/7" (made up the price + claim)

## "audience_line"
Propose ONE sentence describing the customer the business most wants more of. Lift from the services list + service area. Concrete locations / customer types win.
Good: "Cottesloe homeowners booking emergency electrical work."
Good: "Perth families who want a clean home without managing a cleaner."

## "services"
Propose 3 comma-separated services drawing from what's on file + what's typical for the trade. If the business has SOME services already, propose the additional 1-2 that would round out a typical lead-gen ad. If they have none, propose 3 starter services common to the industry.
Good: "Emergency call-outs, switchboard upgrades, safety checks"

## "accent_color"
Propose a hex colour appropriate for the trade. Use the industry default if one is on file (passed below); otherwise pick a strong, ad-friendly colour. Output as #rrggbb.
Good: "#d24317"

# Tone for the rationale

For each field, also write ONE short sentence (max 18 words) explaining WHY this proposal — what you lifted from the brief. Operator-facing, plain English. Don't repeat the proposed value.
Good: "Pulled from your hero copy emphasis on fixed pricing + local."
Good: "Cottesloe + family-home framing matches your hero positioning."

# Hard bans

NEVER invent prices, response times, certifications, percentages, customer counts, or ratings that aren't already in the brief.
NEVER use: "comprehensive", "discerning", "trusted partner", "cutting-edge", "premium quality", "elevate", "transform", "solutions", "best-in-class", "world-class", "industry-leading", "innovative", "seamless", "robust", "leverage", "synergy", "passionate", "dedicated team".
NEVER propose offer copy that contradicts what's already on the brief (e.g. if they already list emergency call-outs, the proposed offer should not be "scheduled work only").

# Output shape

Return ONLY a JSON object of this shape:

{
  "proposals": [
    { "field": "<one of the missing fields>", "proposed": "<the value>", "rationale": "<one short sentence>" }
  ]
}

Only include fields from the missing list. No commentary, no code fences, no explanation. JSON only.`;

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

  const missingRaw = Array.isArray(body.missing) ? body.missing : [];
  const missing: BriefField[] = missingRaw.filter(
    (m): m is BriefField =>
      typeof m === 'string' && VALID_FIELDS.has(m as BriefField),
  );
  if (missing.length === 0) {
    return NextResponse.json({ proposals: [] });
  }

  // Share the angle-gen rate-limit bucket. Same daily cap; proposing
  // fills + generating angles together should not consume two budgets
  // for what the operator perceives as one action.
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

  const brief = await loadBrief(clientId);

  let response;
  try {
    response = await callModel(brief, missing);
  } catch (error) {
    const e = error as { name?: string; status?: number; message?: string };
    return NextResponse.json(
      {
        error: 'propose-failed',
        name: e.name ?? 'unknown',
        status: e.status,
        detail: e.message,
      },
      { status: 500 },
    );
  }

  const text = extractText(response);
  const parsed = parseProposals(text, missing);
  if (parsed === null) {
    return NextResponse.json(
      {
        error: 'propose-failed',
        name: 'invalid-output',
        detail: 'The model returned no parseable proposals.',
      },
      { status: 500 },
    );
  }

  // Defensive: if the model skipped a missing field, fall back to a
  // sensible default so the operator review screen has SOMETHING
  // editable for every gap. Tells them where the gap is + gives them
  // a starting point.
  const proposalsByField = new Map(parsed.map((p) => [p.field, p]));
  const filled: ProposedFill[] = missing.map((field) =>
    proposalsByField.get(field) ?? fallbackProposal(field, brief),
  );
  return NextResponse.json({ proposals: filled });
}

// --- brief resolution ------------------------------------------------------

type Brief = {
  businessName: string;
  serviceArea: string;
  industry: string;
  industryKey: string;
  services: string[];
  audienceLine: string;
  offer: {
    headline: string;
    promise: string;
  } | null;
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

  const industryFreeText = brand?.industry_category ?? client?.industry ?? 'generic';
  const industryKey = mapIndustry(industryFreeText);

  return {
    businessName: client?.name ?? 'this business',
    serviceArea: client?.service_area ?? 'the local area',
    industry: industryFreeText,
    industryKey,
    services: services.slice(0, 12),
    audienceLine: brand?.audience_line?.trim() ?? '',
    offer: parseOffer(brand?.offer),
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
  return { headline, promise };
}

function clampVoice(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}

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

// --- model call -------------------------------------------------------------

async function callModel(brief: Brief, missing: BriefField[]) {
  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const voiceLine = describeVoice(
    brief.voiceFormality,
    brief.voiceUrgency,
    brief.voiceTechnicality,
  );
  const servicesBlock =
    brief.services.length > 0
      ? brief.services.map((s) => `- ${s}`).join('\n')
      : '(none on file)';
  const offerBlock = brief.offer
    ? `Headline: "${brief.offer.headline}"\nPromise: "${brief.offer.promise}"`
    : '(no captured offer)';
  const taglineBlock = brief.brandTagline
    ? `Tagline: "${brief.brandTagline}"`
    : '';
  const audienceBlock = brief.audienceLine
    ? `Audience on file: ${brief.audienceLine}`
    : '(no audience line on file)';
  const heroBlock = brief.websiteHeroCopy
    ? `# Their published site's home-page hero copy\n\n${brief.websiteHeroCopy}`
    : '';
  const industryDefaultColor =
    INDUSTRY_PRIMARY_COLORS[brief.industryKey as keyof typeof INDUSTRY_PRIMARY_COLORS] ??
    INDUSTRY_PRIMARY_COLORS.generic;

  const missingBlock = missing.map((f) => `- ${f}`).join('\n');

  const userMessage = `# Context — what's already on file

Business name: ${brief.businessName}
Service area: ${brief.serviceArea}
Industry: ${brief.industry}
Brand voice: ${voiceLine}
Industry-default accent colour: ${industryDefaultColor}
${audienceBlock}
${taglineBlock}

# Services on file

${servicesBlock}

# Offer on file

${offerBlock}

${heroBlock}

# Fields missing — propose one value + one rationale per field

${missingBlock}

Return the JSON-only shape from the system prompt. Order proposals in the same order as the missing list.`;

  // No thinking — Haiku doesn't need it for short structured output and
  // we want the speed (~1s end-to-end).
  return anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
}

function describeVoice(formality: number, urgency: number, technicality: number): string {
  const parts: string[] = [];
  if (formality <= 2) parts.push('casual + warm');
  else if (formality >= 4) parts.push('professional + measured');
  else parts.push('friendly-professional');
  if (urgency <= 2) parts.push('calm');
  else if (urgency >= 4) parts.push('high-urgency');
  else parts.push('moderate urgency');
  if (technicality <= 2) parts.push('plain English');
  else if (technicality >= 4) parts.push('comfortable with industry terms');
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

// --- parsing ---------------------------------------------------------------

function parseProposals(
  text: string,
  missing: BriefField[],
): ProposedFill[] | null {
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
  const raw = (parsed as { proposals?: unknown }).proposals;
  if (!Array.isArray(raw)) return null;
  const allowed = new Set(missing);
  const valid: ProposedFill[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const field = typeof o.field === 'string' ? (o.field as BriefField) : null;
    if (!field || !allowed.has(field)) continue;
    const proposed = typeof o.proposed === 'string' ? o.proposed.trim() : '';
    const rationale = typeof o.rationale === 'string' ? o.rationale.trim() : '';
    if (proposed.length === 0) continue;
    valid.push({ field, proposed, rationale });
  }
  return valid.length > 0 ? valid : null;
}

// --- fallback (one proposal per skipped field) -----------------------------

function fallbackProposal(field: BriefField, brief: Brief): ProposedFill {
  switch (field) {
    case 'offer': {
      const proposed = brief.services[0]
        ? `Local ${brief.services[0]} — fixed-price quotes, no surprises.`
        : 'Local trade you can trust — fixed-price quotes, no surprises.';
      return {
        field,
        proposed,
        rationale: 'Best-effort fallback — the model didn’t draft this one.',
      };
    }
    case 'audience_line': {
      const proposed = brief.serviceArea
        ? `${brief.serviceArea} customers looking for a local ${brief.industry || 'service business'}.`
        : `Local customers looking for a ${brief.industry || 'trusted'} service business.`;
      return {
        field,
        proposed,
        rationale: 'Best-effort fallback — assembled from your service area + industry.',
      };
    }
    case 'services': {
      const proposed =
        brief.services.length > 0
          ? brief.services.slice(0, 3).join(', ')
          : 'Call-out service, scheduled visit, after-hours support';
      return {
        field,
        proposed,
        rationale: 'Best-effort fallback — generic starter list, edit before saving.',
      };
    }
    case 'accent_color': {
      const proposed =
        INDUSTRY_PRIMARY_COLORS[brief.industryKey as keyof typeof INDUSTRY_PRIMARY_COLORS] ??
        INDUSTRY_PRIMARY_COLORS.generic;
      return {
        field,
        proposed,
        rationale: 'Industry default — change to your brand colour if different.',
      };
    }
  }
}
