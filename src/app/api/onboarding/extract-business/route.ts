// =============================================================================
// POST /api/onboarding/extract-business — turn-1 freeform → structured facts.
//
// Body: { firstMessage: string, industryHint?: string, priorAttempt?: { messages: string[] } }
// Response: { extraction: ConversationExtraction }
//
// Sonnet 4.6 (mirrors /api/generate-offer's model choice). Returns structured
// JSON the conversation shell uses to skip ahead to turn 2 (services picker)
// with a pre-ticked service list — OR, when confidence is low, returns
// `ambiguities[]` so the shell can ask a clarifying question and re-extract.
//
// Auth: open (matches /api/generate-offer). The route does not write
// anywhere — it only reads from Sonnet + the closed industry vocabulary —
// so the same model-call rate limiting applies (Anthropic-side) but no
// tenant authorisation is needed.
//
// Fallback:
//   - 503 when ANTHROPIC_API_KEY is unset (the caller surfaces a clear
//     "not configured" message; the shell uses a defensive fallback that
//     treats the message as low-confidence + asks a clarifying question).
//   - 400 on bad body.
//   - 500 on real failure with { name, status, detail } body (PR #58
//     pattern; matches /api/generate-offer's shape).
//
// generation_log: not written (same precedent as /api/generate-offer —
// turn-1 fires before client_id exists in the conversational shell, so the
// NOT NULL constraint precludes logging here. The 500-body detail carries
// the diagnostic for an operator reading server logs).
// =============================================================================

import { NextResponse } from 'next/server';

import Anthropic from '@anthropic-ai/sdk';

import {
  EXTRACTION_CONFIDENCE_THRESHOLD,
  type ConversationExtraction,
} from '@/lib/onboarding/conversation-types';
import {
  INDUSTRY_TEMPLATES,
  mapIndustry,
  type IndustryKey,
} from '@/lib/website/industry-templates';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

const KNOWN_INDUSTRIES: readonly IndustryKey[] = [
  'electrician',
  'plumber',
  'cleaner',
  'landscaper',
  'roofer',
  'painter',
  'hvac',
  'locksmith',
  'handyman',
  'carpenter',
  'generic',
] as const;

const SYSTEM_PROMPT = `You are an extraction step inside a conversational onboarding flow for trades-business owners (electricians, plumbers, cleaners, landscapers, roofers, painters, HVAC, locksmiths, handymen, carpenters). A customer has just sent ONE freeform message describing their business. Your only job is to read that message and return strict-JSON structured facts.

You are NOT writing copy. You are NOT making the customer feel good. You are extracting. Brevity > completeness.

# Fields you must return

\`\`\`
{
  "industry": "electrician" | "plumber" | "cleaner" | "landscaper" | "roofer" | "painter" | "hvac" | "locksmith" | "handyman" | "carpenter" | "generic",
  "industryFreeText": string | null,
  "location": string,
  "specialty": string,
  "teamSize": string,
  "yearsInBusiness": string,
  "mentionedServices": string[],
  "confidence": number,
  "ambiguities": string[]
}
\`\`\`

## industry
The customer's trade, normalised to one of the closed values above. \`generic\` ONLY when the message contains no trade signal at all (rare — most messages do).

## industryFreeText
The exact phrase the customer used (e.g. "sparkie", "drain man", "Christmas-light installer"). Null when they used a normal industry name that resolves cleanly. Preserves their voice for downstream prompts.

## location
The city / region / suburb / postcode the customer mentioned, verbatim. Empty string when not present. Examples: "Dublin", "Cottesloe", "Perth coastal suburbs", "north Manchester". Do NOT invent a location.

## specialty
The sub-niche or specialty mentioned, verbatim. Examples: "residential rewires", "commercial fit-outs", "emergency callouts only", "fortnightly holiday lets". Empty when nothing specific was said.

## teamSize
Verbatim from the message: "solo", "just me and my brother", "small crew", "team of 8". Empty when not mentioned. Do NOT guess from industry.

## yearsInBusiness
Verbatim: "15 years on the tools", "started last year", "3rd generation". Empty when not mentioned.

## mentionedServices
Array of services the customer mentioned, normalised to match the catalogue below for their resolved industry. Order matches the catalogue (NOT message order — the customer picks visually). Empty array when nothing specific. The shell uses this to pre-tick turn 2's services picker, so accuracy matters more than recall — don't tick things the customer didn't actually say.

## confidence
Number 0.0–1.0. How confident are you that the extracted industry + specialty + services accurately represent the customer's business?
- ≥ 0.6 → the shell proceeds directly to turn 2 with the extraction.
- < 0.6 → the shell asks ONE clarifying question (from your \`ambiguities\` array) and re-runs the extraction with the new context.

Lower confidence when:
- The trade signal is genuinely ambiguous ("we do houses" — could be cleaner, painter, builder, handyman, …)
- The customer mentioned multiple trades that don't normally cohabit
- The message is < 5 words AND carries no trade name
- The customer asked a question instead of describing their business

Don't drive confidence artificially low — a clear "I'm an electrician in Dublin" with no other detail is ≥ 0.85 even though it's short. Length is not the signal; clarity is.

## ambiguities
When confidence < 0.6, list 1–2 short phrases the shell can use to formulate a clarifying question. Each item is a single concept the model couldn't resolve.
- Good: ["industry — \"do houses\" could be cleaning, painting, building, or handyman work", "location — none mentioned"]
- Good: ["which side of HVAC — heating only, cooling only, or both"]
- Bad: ["everything"] — too vague to help the shell ask a follow-up

Empty array when confidence ≥ 0.6.

# Service catalogues per industry

The customer's mentionedServices output MUST come from this catalogue for the resolved industry. Match loosely (e.g. customer says "rewires" → tick "Full & Partial Rewires"; customer says "fuseboards" → tick "Fuse Board Replacement"). Don't tick something not mentioned.

electrician: ["Emergency Callouts", "Fuse Board Replacement", "Full & Partial Rewires", "EV Charger Installation", "Lighting Installation", "Sockets & Power Points", "Smoke Alarm Installation", "Safety Certificates & Inspections", "Fault Finding & Repairs", "PAT Testing", "Outdoor & Garden Lighting", "Bathroom Extractor Fans"]
plumber: ["Emergency Callouts", "Boiler Servicing", "Boiler Repair & Replacement", "Bathroom Installation", "Tap & Toilet Repairs", "Leak Detection & Repair", "Burst Pipe Repair", "Drain Unblocking", "Hot Water Cylinder Replacement", "Radiator Installation", "Power Flushing", "Gas Safety Certificates"]
cleaner: ["Regular Domestic Cleaning", "End of Tenancy Cleaning", "Deep Cleans & Spring Cleaning", "Office & Commercial Cleaning", "Holiday Let Turnover", "Post-Build / Renovation Cleaning", "Carpet & Upholstery Cleaning", "Window Cleaning", "Move-In / Move-Out", "Recurring Schedules"]
landscaper: ["Lawn Mowing & Maintenance", "Hedge & Tree Pruning", "Garden Design & Planting", "Patio & Decking", "Turf Laying", "Fence Installation & Repair", "Pressure Washing", "Garden Clearance", "Irrigation", "Seasonal Tidy-ups"]
roofer: ["Roof Repairs", "Full Roof Replacement", "Gutter Installation & Cleaning", "Chimney Repair & Repointing", "Leadwork & Flashing", "Flat Roof Installation", "Slate & Tile Repair", "Velux & Skylight Installation", "Soffits & Fascias", "Storm Damage Repair"]
painter: ["Interior House Painting", "Exterior House Painting", "Commercial Painting", "Wallpaper Hanging & Removal", "Plaster Repair", "Spray Painting", "Decorative Finishes", "Restoration & Heritage Work", "Quick Property Refresh", "Colour Consultation"]
hvac: ["Air Conditioning Installation", "Air Conditioning Service & Repair", "Boiler Installation", "Boiler Service & Repair", "Heat Pump Installation", "Ventilation Systems", "Underfloor Heating", "Duct Cleaning", "Annual Service Plans", "Emergency Breakdowns"]
locksmith: ["Emergency Lockouts", "Lock Installation & Replacement", "Smart Lock Installation", "Safe Opening & Installation", "Window Lock Repairs", "Snapped Key Extraction", "Burglary Repairs", "UPVC Door Repair", "Master Key Systems", "Mobile Same-day Service"]
handyman: ["Furniture Assembly", "TV Mounting", "Shelving & Fixings", "Door & Window Repairs", "Small Plumbing Fixes", "Small Electrical Fixes", "Painting Touch-ups", "Outdoor / Fence Repair", "Property Maintenance", "Picture Hanging"]
carpenter: ["Bespoke Joinery", "Built-in Wardrobes & Storage", "Kitchen Fitting", "Decking & Garden Structures", "Door Hanging & Repair", "Skirting & Architrave", "Loft Conversions", "Stairs & Bannisters", "Window Frames & Sashes", "Restoration"]
generic: []

If the message resolves to \`generic\`, return mentionedServices: [].

# When you get a prior-attempt re-run

The body may include \`priorAttempt.messages\` — the original message + the bot's clarifying question + the customer's clarifying answer. Read all three. Use the combined context to resolve the previously-ambiguous fields. Confidence should rise above 0.6 unless the customer's answer was itself unhelpful.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. Match the schema above exactly. Do not invent fields.`;

type Body = {
  firstMessage?: unknown;
  industryHint?: unknown;
  priorAttempt?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'extraction-not-configured' }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const firstMessage = readString(body.firstMessage);
  if (!firstMessage) {
    return NextResponse.json(
      { error: 'first-message-required' },
      { status: 400 },
    );
  }
  if (firstMessage.length > 4000) {
    return NextResponse.json(
      { error: 'first-message-too-long' },
      { status: 400 },
    );
  }

  const industryHint = readString(body.industryHint);
  const priorMessages = readPriorAttemptMessages(body.priorAttempt);

  const userMessage = composeUserMessage({ firstMessage, industryHint, priorMessages });

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      // No thinking — extraction is mechanical reading, not reasoning.
      // Adds latency we don't need at this turn (the customer is waiting).
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
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    const parsed = parseExtraction(text);
    const normalised = normaliseExtraction(parsed, { firstMessage });
    return NextResponse.json({ extraction: normalised });
  } catch (error) {
    console.error('[extract-business] extraction failed', error);
    const detail = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : 'Error';
    const status =
      typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : undefined;
    return NextResponse.json(
      { error: 'extraction-failed', name, status, detail },
      { status: 500 },
    );
  }
}

// --- helpers ----------------------------------------------------------------

function composeUserMessage(args: {
  firstMessage: string;
  industryHint: string;
  priorMessages: string[];
}): string {
  const parts: string[] = [];
  if (args.priorMessages.length > 0) {
    parts.push('Prior conversation (read all three):');
    args.priorMessages.forEach((m, i) => {
      const role = i === 0 ? 'Customer (initial)' : i === 1 ? 'Bot (clarifying question)' : 'Customer (clarification)';
      parts.push(`${role}: ${m}`);
    });
    parts.push('');
    parts.push('Now extract from the combined context above. Confidence should rise unless the clarification was itself unhelpful.');
  } else {
    parts.push("Customer's first message:");
    parts.push(args.firstMessage);
    if (args.industryHint) {
      parts.push('');
      parts.push(`Industry hint (from signup, if any): ${args.industryHint}`);
    }
    parts.push('');
    parts.push('Extract the structured facts. Return the JSON object only.');
  }
  return parts.join('\n');
}

function readPriorAttemptMessages(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const v = value as { messages?: unknown };
  if (!Array.isArray(v.messages)) return [];
  return v.messages
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .slice(0, 6); // sanity cap; the shell only sends 3 in practice
}

type RawExtraction = {
  industry?: unknown;
  industryFreeText?: unknown;
  location?: unknown;
  specialty?: unknown;
  teamSize?: unknown;
  yearsInBusiness?: unknown;
  mentionedServices?: unknown;
  confidence?: unknown;
  ambiguities?: unknown;
};

function parseExtraction(text: string): RawExtraction {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('extract-business: model response contained no JSON object');
  }
  return JSON.parse(body.slice(start, end + 1)) as RawExtraction;
}

function normaliseExtraction(
  raw: RawExtraction,
  ctx: { firstMessage: string },
): ConversationExtraction {
  const industryStr = readString(raw.industry).toLowerCase();
  const industry: IndustryKey = (KNOWN_INDUSTRIES as readonly string[]).includes(industryStr)
    ? (industryStr as IndustryKey)
    : mapIndustry(industryStr || ctx.firstMessage);

  const industryFreeTextRaw = raw.industryFreeText;
  const industryFreeText: string | null =
    typeof industryFreeTextRaw === 'string' && industryFreeTextRaw.trim()
      ? industryFreeTextRaw.trim()
      : null;

  const mentionedServices = Array.isArray(raw.mentionedServices)
    ? filterToCatalogue(industry, raw.mentionedServices)
    : [];

  const confidenceRaw = typeof raw.confidence === 'number' ? raw.confidence : NaN;
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.max(0, Math.min(1, confidenceRaw))
    : EXTRACTION_CONFIDENCE_THRESHOLD - 0.1; // missing → treat as low

  const ambiguities = Array.isArray(raw.ambiguities)
    ? raw.ambiguities
        .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim())
        .slice(0, 4)
    : [];

  return {
    industry,
    industryFreeText,
    location: readString(raw.location),
    specialty: readString(raw.specialty),
    teamSize: readString(raw.teamSize),
    yearsInBusiness: readString(raw.yearsInBusiness),
    mentionedServices,
    confidence,
    ambiguities,
  };
}

/** Defensive filter: keep only services that match the resolved industry's
 *  defaultServices catalogue. The model is supposed to do this itself, but
 *  this guards against ticking services from the wrong industry. */
function filterToCatalogue(industry: IndustryKey, raw: unknown[]): string[] {
  const template = INDUSTRY_TEMPLATES[industry];
  if (!template) return [];
  const catalogue = template.defaultServices;
  const lower = new Map<string, string>();
  catalogue.forEach((s) => lower.set(s.toLowerCase(), s));
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const match = lower.get(v.trim().toLowerCase());
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
