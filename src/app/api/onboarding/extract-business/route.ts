// =============================================================================
// POST /api/onboarding/extract-business — turn-1 freeform → structured facts.
//
// Body: { firstMessage: string, industryHint?: string, priorAttempt?: { messages: string[] } }
// Response (discriminated):
//   { refused: true, refuseReason: 'restaurant' | 'ecom' }
//   | { refused: false, extraction: ConversationExtraction }
//
// (Pre-catch-all the response was { extraction: ConversationExtraction }
// straight — the discriminated shape is additive: the shell looks at
// `refused` first.)
//
// Sonnet 4.6 (mirrors /api/generate-offer's model choice). Returns structured
// JSON the conversation shell uses to:
//   • skip ahead to turn 2 (services picker) with a pre-ticked service list, OR
//   • ask a clarifying question + re-extract when confidence < 0.6, OR
//   • mount the refusal screen when the business is a restaurant / ecom store.
//
// Catch-all framing (May 2026):
//   Webnua supports ANY service business that needs leads — trades, professional
//   services (accountants, photographers, consultants), personal services
//   (personal trainers, dog grooming, car valeting, tutoring, physio…). The 10
//   curated industries (`electrician`, `plumber`, etc.) keep their bespoke
//   prompts; everything else resolves to `generic` AND the conversation
//   continues silently — the customer never sees that they hit a fallback.
//
//   The two exclusions are restaurants/food and ecommerce — both need different
//   tools (booking + menu, cart + fulfilment), so we refuse the signup and
//   route the customer to hello@webnua.com for a manual build at the same
//   price. The refused workspace is flipped to `lifecycle_status='banned'`
//   by the shell so it doesn't count as a seat.
//
// Auth: open (matches /api/generate-offer). The route does not write
// anywhere — it only reads from Sonnet — so the same model-call rate
// limiting applies (Anthropic-side) but no tenant authorisation is needed.
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
  type RefuseReason,
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

const REFUSE_REASONS: readonly RefuseReason[] = ['restaurant', 'ecom'];

const SYSTEM_PROMPT = `You are an extraction step inside a conversational onboarding flow for service-business owners. The customer has just sent ONE freeform message describing their business. Your only job is to read that message and return strict-JSON structured facts.

Webnua is built for any service business that needs leads — trades (electricians, plumbers, cleaners, landscapers, roofers, painters, HVAC, locksmiths, handymen, carpenters), but ALSO any other local or professional service: car valeting, dog grooming, mobile mechanics, personal trainers, tutors, accountants, wedding photographers, physiotherapists, consultants, etc. The 10 trades above have bespoke template content; everything else resolves to \`generic\` and the conversation continues seamlessly.

The ONLY two business types Webnua refuses are restaurants (any food-service venue: cafes, takeaways, bars, food trucks) and ecommerce stores (online shops, dropshipping, Shopify stores, marketplace sellers, digital products). Those need different tools (booking + menu management for restaurants; cart + fulfilment for ecommerce) — we politely redirect those to hello@webnua.com for a manual build.

You are NOT writing copy. You are NOT making the customer feel good. You are extracting. Brevity > completeness.

# Fields you must return

\`\`\`
{
  "refused": false,
  "businessName": string,
  "industry": "electrician" | "plumber" | "cleaner" | "landscaper" | "roofer" | "painter" | "hvac" | "locksmith" | "handyman" | "carpenter" | "generic",
  "industryFreeText": string | null,
  "industryDescription": string,
  "location": string,
  "specialty": string,
  "teamSize": string,
  "yearsInBusiness": string,
  "mentionedServices": string[],
  "confidence": number,
  "ambiguities": string[]
}
\`\`\`

OR (when refused):

\`\`\`
{
  "refused": true,
  "refuseReason": "restaurant" | "ecom"
}
\`\`\`

When refused: return ONLY \`refused\` + \`refuseReason\`. Do NOT also return extraction fields.

## refused
\`true\` only when the business is unambiguously a restaurant/food-service OR an ecommerce store. Default \`false\`. When in doubt about whether something is "service business that needs leads" — DEFAULT TO \`false\` and let it fall through to \`generic\`. We'd rather support a niche service business with a generic template than wrongly refuse a real customer.

## refuseReason
- \`"restaurant"\` — cafes, restaurants, bars, takeaways, food trucks, catering venues (with a fixed location). A private chef cooking at customers' homes for events is NOT a restaurant — it is a service business (\`generic\`).
- \`"ecom"\` — online stores, dropshipping, Shopify shops, digital product sellers, marketplace sellers (Amazon FBA, Etsy stores). A trade business that ALSO has a small webshop for branded merch is NOT ecom — it is the trade.

## businessName
The customer's business name. Three patterns:
- The customer named the business directly: "We're Smith & Sons Plumbing in Galway" → "Smith & Sons Plumbing". "I'm Bob's Electrical" → "Bob's Electrical". Use the exact business name as given (preserve apostrophes, ampersands, casing).
- The customer described what they do + where but did NOT name a business: "I'm a painter from Cork" → "Cork Painters". "Sparkie in Dublin" → "Dublin Electrical". Compose a plain "{Location} {Trade-plural}" name. Capitalise Title Case. Use the COMMON English trade name ("Electrical" / "Plumbing" / "Cleaning" / "Painters" / "Landscaping" / "Roofing" / "Locksmiths" / "HVAC" / "Carpentry" / "Handyman") — not the slang the customer used ("sparkie"/"chippy" stay in industryFreeText, not the business name).
- The customer described what they do without a location AND without a business name: "I'm a painter" → "" (empty). Do NOT invent a location.

If you're unsure between a derived name and an extracted one, prefer the extracted one. Empty string is safer than a wrong name.

## industry
The customer's trade, normalised to one of the closed values above. Use one of the 10 named trades when the message clearly matches that trade's vocabulary. Use \`generic\` for ANY service business outside those 10 — be generous; don't try to force a near-match. Examples:
- "I'm an electrician" → \`electrician\`
- "I do dog grooming" → \`generic\`
- "Personal trainer in Galway" → \`generic\`
- "Accountant for small businesses" → \`generic\`
- "Car valet in Perth" → \`generic\`
- "Wedding photographer" → \`generic\`
- "Mobile mechanic" → \`generic\` (NOT \`hvac\` even though it involves engines)

## industryFreeText
The exact phrase the customer used for their trade (e.g. "sparkie", "drain man", "dog groomer", "car valet"). Null when they used a normal industry name that resolves cleanly to one of the 10. For \`generic\` results, ALWAYS populate this — it is the bridge between the customer's actual words and the neutral template, so the generator can write copy that says "your car valeting" instead of "your services".

## industryDescription
A short professional descriptor of the business — 2-6 words, Title Case. Examples: "Mobile car valeting", "Residential dog grooming", "Personal training", "Wedding photography", "Small-business accounting", "Mobile mechanic services". For one of the 10 named trades you can leave this empty (the template covers it). For \`generic\` ALWAYS populate this. Do NOT invent: stay close to the customer's own words.

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

For \`generic\` industries: return an empty array. The customer's services are their own words — we don't try to match them to a closed catalogue here.

## confidence
Number 0.0–1.0. How confident are you that the extracted industry + specialty + services accurately represent the customer's business?
- ≥ 0.6 → the shell proceeds directly to turn 2 with the extraction.
- < 0.6 → the shell asks ONE clarifying question (from your \`ambiguities\` array) and re-runs the extraction with the new context.

Lower confidence when:
- The trade signal is genuinely ambiguous between two of the 10 named trades that have different prompt content ("we do houses" — cleaner vs painter vs builder vs handyman)
- The customer mentioned multiple trades that don't normally cohabit
- The message is < 5 words AND carries no trade name
- The customer asked a question instead of describing their business

Don't drive confidence artificially low — a clear "I'm an electrician in Dublin" with no other detail is ≥ 0.85 even though it's short. A clear "I do dog grooming in Hobart" with no further detail is ALSO ≥ 0.85 — \`generic\` is a confident answer when the message itself is clear; it is NOT an "I don't know" answer. Length is not the signal; clarity is.

## ambiguities
When confidence < 0.6, list 1–2 short phrases the shell can use to formulate a clarifying question. Each item is a single concept the model couldn't resolve.
- Good: ["industry — \\"do houses\\" could be cleaning, painting, building, or handyman work", "location — none mentioned"]
- Good: ["which side of HVAC — heating only, cooling only, or both"]
- Bad: ["everything"] — too vague to help the shell ask a follow-up

Empty array when confidence ≥ 0.6.

# Worked examples

\`\`\`
"car valet in perth"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "car valet",
  "industryDescription": "Mobile car valeting",
  "location": "Perth",
  ...
  "confidence": 0.85,
  "ambiguities": []
}

"I do dog grooming, mostly small breeds, mobile in Auckland"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "dog grooming",
  "industryDescription": "Mobile dog grooming",
  "location": "Auckland",
  "specialty": "mostly small breeds, mobile service",
  ...
  "confidence": 0.9
}

"personal trainer in Galway, just me at the moment"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "personal trainer",
  "industryDescription": "Personal training",
  "teamSize": "just me at the moment",
  ...
}

"I'm an accountant for small businesses"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "accountant",
  "industryDescription": "Small-business accounting",
  "specialty": "small businesses",
  ...
}

"I run a coffee shop in Galway"
→ { "refused": true, "refuseReason": "restaurant" }

"We have a cafe with takeaway"
→ { "refused": true, "refuseReason": "restaurant" }

"I sell sneakers on Shopify"
→ { "refused": true, "refuseReason": "ecom" }

"I run a dropshipping store"
→ { "refused": true, "refuseReason": "ecom" }

"I'm a personal chef cooking for private events in clients' homes"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "personal chef",
  "industryDescription": "Private-event personal chef",
  ...
}
(NOT a restaurant — no fixed venue, service delivered to customers.)

"Plumber in Dublin, 10 years"
→ {
  "refused": false,
  "industry": "plumber",
  "industryFreeText": null,
  "industryDescription": "",
  ...
}

"Wedding photographer covering all of Ireland"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "wedding photographer",
  "industryDescription": "Wedding photography",
  "location": "Ireland",
  ...
}

"Physio clinic in Cork, two practitioners"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "physio",
  "industryDescription": "Physiotherapy practice",
  "location": "Cork",
  "teamSize": "two practitioners",
  ...
}

"Tutoring business — primary school maths"
→ {
  "refused": false,
  "industry": "generic",
  "industryFreeText": "tutor",
  "industryDescription": "Primary-school maths tutoring",
  "specialty": "primary school maths",
  ...
}
\`\`\`

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

type ExtractionResponseBody =
  | { refused: true; refuseReason: RefuseReason }
  | { refused: false; extraction: ConversationExtraction };

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
    const responseBody = normaliseResponse(parsed, { firstMessage });
    return NextResponse.json(responseBody);
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
  refused?: unknown;
  refuseReason?: unknown;
  businessName?: unknown;
  industry?: unknown;
  industryFreeText?: unknown;
  industryDescription?: unknown;
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

/** Normalise the raw model output into the discriminated response shape.
 *  Refusal short-circuits — every other field is dropped on refusal so the
 *  shell can't accidentally read partial extraction state for a banned
 *  signup. A malformed refuse-reason falls through to the extraction path
 *  (we'd rather seat-cost a misclassified ecom signup than reject a real
 *  customer). */
function normaliseResponse(
  raw: RawExtraction,
  ctx: { firstMessage: string },
): ExtractionResponseBody {
  if (raw.refused === true) {
    const refuseReasonRaw = readString(raw.refuseReason).toLowerCase();
    if ((REFUSE_REASONS as readonly string[]).includes(refuseReasonRaw)) {
      return { refused: true, refuseReason: refuseReasonRaw as RefuseReason };
    }
    // Model said refused: true but gave an unrecognised reason. Fall
    // through to the extraction path rather than guess — the model
    // already returned no extraction fields, so let it resolve as
    // generic with low confidence + a clarifying question.
    console.warn('[extract-business] refused=true with unknown refuseReason:', raw.refuseReason);
  }

  return {
    refused: false,
    extraction: normaliseExtraction(raw, ctx),
  };
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

  // Business name — trim, cap length defensively, drop pathological model
  // output ("undefined", "null", "n/a") to empty so the downstream slugify
  // doesn't produce nonsense workspace URLs.
  const businessNameRaw = readString(raw.businessName);
  const businessName =
    businessNameRaw.length > 0 && businessNameRaw.length <= 80 &&
    !/^(undefined|null|n\/?a|none|nil|tbd|tbc)$/i.test(businessNameRaw)
      ? businessNameRaw
      : '';

  // Industry description — for generic, the human-readable bridge between
  // the customer's free-text trade name and the generic template. For one
  // of the 10 named trades this is usually empty (the template covers it),
  // but we still trim + cap defensively when populated.
  const industryDescriptionRaw = readString(raw.industryDescription);
  const industryDescription =
    industryDescriptionRaw.length > 0 && industryDescriptionRaw.length <= 80
      ? industryDescriptionRaw
      : '';

  return {
    businessName,
    industry,
    industryFreeText,
    industryDescription,
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
