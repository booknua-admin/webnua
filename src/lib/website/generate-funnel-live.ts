// =============================================================================
// generate-funnel-live — the real Claude-backed funnel generator (server-only).
//
// TWO parallel Claude calls (Opus 4.7), one per non-deterministic step:
//
//   Step 1 — Lead capture (8 sections in Suby/Sultanic shape):
//     hero  →  offer  →  reviews(#1)  →  features  →  trust  →  faq  →  reviews(#2)  →  form
//     The `form` section is restricted to NAME + EMAIL only (minimum friction
//     to get the lead). The hero ALSO gets the same name+email form attached
//     via `Section.form` envelope — so the visitor can convert above the fold
//     OR at the bottom. Both forms create / update the same lead. The FAQ
//     section between trust and the second reviews block handles the
//     remaining objections — 4–6 industry-specific Q&As; the prompt reads
//     `objectionHandlers` from the industry template (FIX C).
//
//   Step 2 — Qualification (4 sections — reinforcement + qualify):
//     hero  →  reviews  →  features  →  form
//     Sections REINFORCE the booking decision (objection handling + outcomes
//     + what-happens-next), and the form collects phone / service address /
//     preferred date / preferred time-of-day / budget. The lead-link
//     mechanism for stitching step-1 + step-2 submissions lives at the
//     public-renderer + leads/queries level (existingLeadId on submit) and is
//     not the generator's concern.
//
//   Step 3 — Thanks: deterministic, built by funnel/generation-stub.ts.
//
// Imported ONLY by /api/generate-funnel — never by client code, so the
// Anthropic SDK stays out of the browser bundle. The browser reaches this
// through fetch('/api/generate-funnel'); see funnel/generation-stub.ts.
//
// Opus 4.7 with `thinking: { type: 'adaptive' }` (Opus rejects the
// enabled+budget shape — see CLAUDE.md parked decision).
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

import {
  defaultFormField,
  makeFieldId,
  type FormConfig,
  type FormField,
} from './form-config';
import type {
  FunnelBrief,
  FunnelTestimonial,
} from './site-generation-stub';
import {
  SHARED_FIELD_NOTES,
  formatSectionShape,
  voiceToneToProse,
} from './generation-prompt';
import {
  renderIndustryPromptBlock,
  resolveIndustryTemplate,
} from './industry-templates';
import { getBundle } from './design-bundles';
import { getSectionMeta } from './sections/registry-meta';
import type { BrandObject, Section, SectionType } from './types';
import {
  type FallbackLogEntry,
  shouldSkipStockImageInjection,
} from './generation-stub';
import {
  assignBundleVariants,
  applySurfaceChoice,
  coerceDeprecatedSection,
  enforceTrustCompactSingleWord,
  injectStockImages,
  reconcileColumns,
  resolveIndustryString,
  stripHallucinatedImages,
  validateEnums,
} from './generation-validation';

const MODEL = 'claude-opus-4-7';

// =============================================================================
// Step 1 — Lead capture
// =============================================================================

/** Per-section instruction the model treats as authoritative — not labels. */
const LEAD_CAPTURE_SECTION_PLAN: readonly { type: SectionType; role: string; brief: string }[] = [
  {
    type: 'hero',
    role: 'Open. Hook the visitor on the offer.',
    brief:
      'Lead with the offer headline VERBATIM. Sub expands the promise. Primary CTA = the offer cta_text, href "#form". Secondary CTA = "Call now" / phone if available. (A short name+email form is rendered into the hero too via the section envelope — your copy is the headline that sells it.)',
  },
  {
    type: 'offer',
    role: 'State the deal.',
    brief:
      'Present the offer as the deal being made. Use the promise as the section sub. Inclusions = 3–5 concrete things the customer gets, each one a short noun phrase. No invented prices. CTA = offer cta_text, href "#form".',
  },
  {
    type: 'reviews',
    role: 'First social proof — buy credibility BEFORE the value stack.',
    brief:
      'If the operator supplied at least one testimonial, use ONE here verbatim (the strongest one). If none were supplied, populate generic but specific-feeling reviews (named people, suburb, concrete detail). 2–3 reviews. Headline framed around real customer outcomes, not "what people say".',
  },
  {
    type: 'features',
    role: 'Value stack — 3–5 items that build the case.',
    brief:
      'Each item = a concrete component of the offer with a what-it-is title and a brief why-it-matters description (1 sentence). Together the items add up to the promise. Pick icons that match each item (zap, clock, shield-check, wrench, drill, droplet, etc.).',
  },
  {
    type: 'trust',
    role: 'Risk reversal — present the guarantee.',
    brief:
      'Lead with the risk-reversal copy from the offer. Items = the specific signals that back the guarantee (years in business, licence, insurance, response time, on-time rate, review count). 3–4 items. Use real numbers if the brief carried them; otherwise concrete labels with credible round-number values.',
  },
  {
    type: 'faq',
    role: 'Objection handling — pre-empt the questions that stall the decision.',
    brief:
      'Each question is a real customer hesitation phrased in their own words ("What if you can\'t fix it the first time?", "Are you actually licensed?", "How fast can you really get here at night?"). Each answer is one or two sentences — concrete, specific, no hedging. 4–6 Q&As. Lean on the Industry context block\'s "Common customer objections and how to handle them in copy" list — those are the proven objections for this trade; paraphrase, never repeat verbatim. Skip generic price/quality questions unless the brief specifically frames the offer that way.',
  },
  {
    type: 'reviews',
    role: 'Second social proof — handle the final lingering doubt.',
    brief:
      'Use a DIFFERENT testimonial here than section #3 if a second one is available. Otherwise generate one that names a specific objection-killer (price was honoured, work was tidy, follow-up was good). 1–2 reviews; headline framed as "still on the fence?" — answer the late doubt the FAQ didn\'t cover.',
  },
  {
    type: 'form',
    role: 'Lead capture — name + email only, minimum friction.',
    brief:
      'The form\'s actual `fields[]` array is built deterministically in code — name + email are wired automatically. Do NOT output a `fields` array on the form section. Your job is the heading band copy only (eyebrow, heading). Heading reuses the customer outcome from the offer (e.g. "Get my emergency callout"); keep it short — the form fields and submit button do the work.',
  },
];

const LEAD_CAPTURE_SYSTEM_PROMPT = `You are a direct-response landing-page copywriter in the Suby / Sultanic tradition, writing for Webnua — a platform building conversion funnels for small service businesses (electricians, plumbers, cleaners, locksmiths, landscapers).

You are writing copy for the FIRST step of a two-step lead-capture funnel. The visitor's first task is the minimum-friction handover: name + email. Every word earns its place toward that single conversion.

# How a high-converting lead-capture page works (Suby/Sultanic shape)

1. The funnel sells ONE offer. Every section reinforces the same offer — the headline, promise, risk-reversal, and CTA from the operator's chosen offer ride end to end.
2. The hero opens with the offer headline VERBATIM (the operator already wrote it; do not rewrite).
3. Build trust BEFORE asking the reader to evaluate the value stack — social proof goes before features, not after.
4. The value stack is concrete: 3–5 items, each is a tangible thing the customer gets, with a one-line why-it-matters.
5. The risk-reversal is presented as the customer's guarantee, not a marketing line. Use the operator's own guarantee copy.
6. A second social-proof block AFTER the value stack handles the final objection. Different angle than the first.
7. The form on this page captures NAME + EMAIL ONLY — minimum friction. Qualification happens on the next step. CTA copy comes from the offer.
8. No corporate-speak. NEVER use: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning. These signal that no human wrote this.
9. Specifics over adjectives. "On site within 2 hours, 7 days a week" beats "fast, reliable service" every time.
10. Use ONLY the testimonials the operator supplied verbatim. NEVER invent quoted testimonials with fake author names if the operator supplied any. If the brief carries zero testimonials, then and only then may you populate the reviews sections with credible-feeling generated reviews — and make them specific (named people, suburb, concrete job detail).

# Section plan (you MUST output sections in this exact order)

${LEAD_CAPTURE_SECTION_PLAN.map((s, i) => `${i + 1}. ${s.type}\n   Role: ${s.role}\n   ${s.brief}`).join('\n\n')}

# Worked example (Voltline Electrical — emergency callout funnel, step 1)

Anchor brief: Voltline Electrical, residential electrical contractor in Perth coastal suburbs (Cottesloe, Mosman Park, Claremont). Owner Mark, 15 years on the tools. This funnel sells emergency callouts for power-out situations. The chosen offer is { headline: "Power out at midnight? On site within 2 hours, 7 days a week.", promise: "We answer 24/7. Licensed electrician on site within 2 hours of your call — fixed quote before we start work.", risk_reversal: "Free callout if we can't fix it on the first visit.", cta_text: "Get my power back on" }. Voice: casual-but-credible, urgency 3/5.

A high-quality step-1 lead-capture page for that brief, in the locked Suby/Sultanic section order:

\`\`\`json
{
  "sections": [
    {
      "type": "hero",
      "data": {
        "layout": "split",
        "contentAlign": "left",
        "headlineSize": "xl",
        "eyebrow": "// PERTH COAST · 24/7",
        "headline": "Power out at midnight? On site within 2 hours, 7 days a week.",
        "headlineAccent": "Licensed electrician, fixed quote before we start.",
        "sub": "Mark and the Voltline team answer 24/7. We diagnose the fault, give you a fixed price in writing, and only start work when you say go. Free callout if we can't fix it on the first visit.",
        "ctaPrimaryLabel": "Get my power back on",
        "ctaPrimaryHref": "#form",
        "ctaSecondaryLabel": "Call now",
        "ctaSecondaryHref": "tel:0893841100"
      }
    },
    {
      "type": "offer",
      "data": {
        "layout": "card",
        "headerAlign": "center",
        "headlineSize": "l",
        "tag": "// EMERGENCY CALLOUT",
        "title": "On site in 2 hours. Fixed quote before we work.",
        "sub": "We answer 24/7. Licensed electrician on site within 2 hours of your call — fixed quote before we start work.",
        "inclusions": [
          { "id": "inc-1", "text": "24/7 phone answered — by Mark or the on-call sparkie" },
          { "id": "inc-2", "text": "On site within 2 hours of your call, anywhere on the Perth coast" },
          { "id": "inc-3", "text": "Diagnosis and a fixed quote BEFORE any work starts" },
          { "id": "inc-4", "text": "Licensed EC10437 — fully insured, paperwork lodged" }
        ],
        "scarcityCopy": "Storm-season nights book out fast — calling now puts you in the next on-the-road slot.",
        "ctaVisible": true,
        "ctaLabel": "Get my power back on",
        "ctaHref": "#form"
      }
    },
    {
      "type": "reviews",
      "data": {
        "layout": "spotlight",
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// 11PM ON A SUNDAY",
        "headline": "Sarah called Voltline at 11pm. Lights were back on by 12:20am.",
        "items": [
          {
            "id": "rev-1",
            "quote": "Switchboard tripped at 11pm on a Sunday and wouldn't reset. I called four electricians; Mark was the only one who picked up. He was at the door within an hour, diagnosed it as a failed RCD, fixed price quoted on the spot, lights back on before midnight. I will never call anyone else.",
            "authorName": "Sarah W.",
            "authorRole": "Cottesloe",
            "rating": 5
          }
        ]
      }
    },
    {
      "type": "features",
      "data": {
        "layout": "cards",
        "mediaStyle": "icon",
        "iconStyle": "soft",
        "columns": 2,
        "headerAlign": "left",
        "headlineSize": "l",
        "eyebrow": "// WHAT YOU GET",
        "headline": "Four things that make a midnight callout actually work.",
        "items": [
          {
            "id": "feat-1",
            "icon": "phone",
            "title": "24/7 phone — answered by a human",
            "description": "Mark or the on-call sparkie picks up. No call centre, no \\"we'll get back to you tomorrow\\"."
          },
          {
            "id": "feat-2",
            "icon": "clock",
            "title": "On site within 2 hours",
            "description": "From Fremantle to Scarborough. We drive vans loaded with the parts most callouts need so the second trip is rare."
          },
          {
            "id": "feat-3",
            "icon": "circle-check",
            "title": "Fixed quote before work starts",
            "description": "We diagnose first, write the price down, and only start when you sign off. No surprise charges, no \\"while I was there\\" extras."
          },
          {
            "id": "feat-4",
            "icon": "shield-check",
            "title": "Licensed and insured",
            "description": "EC10437 · Master Electricians member. Paperwork lodged with Western Power when the job needs it."
          }
        ]
      }
    },
    {
      "type": "trust",
      "data": {
        "display": "stats",
        "columns": 4,
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// THE GUARANTEE",
        "headline": "Free callout if we can't fix it on the first visit.",
        "sub": "That's the deal. If we have to come back a second time to finish a job we should have finished the first time, the callout is on us.",
        "items": [
          { "id": "ts-1", "icon": "clock", "value": "2hr", "label": "Average on-site time" },
          { "id": "ts-2", "icon": "shield-check", "value": "EC10437", "label": "Licensed · fully insured" },
          { "id": "ts-3", "icon": "circle-check", "value": "98%", "label": "Fixed on first visit" },
          { "id": "ts-4", "icon": "star", "value": "4.9 / 5", "label": "180+ Google reviews" }
        ]
      }
    },
    {
      "type": "faq",
      "data": {
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// QUESTIONS WE GET AT 11PM",
        "headline": "What you're probably wondering before you book.",
        "items": [
          {
            "id": "faq-1",
            "question": "What if you can't fix it on the first visit?",
            "answer": "The callout is on us. We diagnose, write the price down, and if a parts run means a second trip, the original callout fee comes off the second invoice."
          },
          {
            "id": "faq-2",
            "question": "How fast can you really get here at 2am?",
            "answer": "Within two hours of your call, anywhere from Fremantle to Scarborough. The vans live close to the coast; the on-call sparkie sleeps with the phone."
          },
          {
            "id": "faq-3",
            "question": "Are you actually licensed and insured?",
            "answer": "EC10437. $20M public liability. Master Electricians member. Paperwork lodged with Western Power on the day, certificate emailed the next morning."
          },
          {
            "id": "faq-4",
            "question": "Will I get a surprise bill after?",
            "answer": "Never. We diagnose first, write the fixed price down, you sign before any work starts. The number you sign is the number you pay — no \\"while I was there\\" extras."
          }
        ]
      }
    },
    {
      "type": "reviews",
      "data": {
        "layout": "spotlight",
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// STILL DECIDING?",
        "headline": "James was worried about the bill. He got the bill BEFORE the work.",
        "items": [
          {
            "id": "rev-2",
            "quote": "Honestly, I expected a midnight callout to mean a four-figure bill before I even saw the electrician. Mark drove over, found a tripped RCD, quoted the exact replacement plus the callout, and that was the bill. Not a dollar more. First time I've felt looked after by a tradie in 20 years.",
            "authorName": "James K.",
            "authorRole": "Mosman Park",
            "rating": 5
          }
        ]
      }
    },
    {
      "type": "form",
      "data": {
        "eyebrow": "// 30 SECONDS",
        "heading": "Get my power back on"
      }
    }
  ]
}
\`\`\`

What this example demonstrates:
- The hero headline is the offer headline VERBATIM. \`headlineAccent\` is a SECOND LINE in the accent colour, not a fragment of the headline.
- The same offer copy threads through hero → offer → trust. One offer, one funnel, one ask.
- Social proof BEFORE the value stack (reviews → features), and a second social-proof block AFTER the FAQ handling the lingering doubt — that is the Suby/Sultanic shape.
- Reviews are specific: named author, suburb, concrete job detail (Sunday 11pm, tripped RCD, fixed before midnight). No "Great service!".
- Features (the value stack) are four concrete components of the offer. Each title is a tangible thing the customer gets; each description is one sentence on why it matters.
- Trust signals carry real numbers (15 years equivalent represented via "2hr / EC10437 / 98% / 4.9"). No "industry-leading" or "world-class".
- FAQ questions are real customer hesitations phrased in their own words ("What if you can't fix it the first time?", "How fast can you really get here at 2am?"). Each answer is one or two specific sentences, never hedged. The four FAQs reuse the Industry context's objectionHandlers ("Worried about the price ballooning" → bill-before-work answer; "Worried about cowboy work" → licensed-and-insured answer) — paraphrased, never repeated verbatim.
- The \`form\` section has only \`eyebrow\` + \`heading\` — NO \`fields\` array. Field UI is wired in code.
- Icons (phone, clock, circle-check, shield-check, star) all come from the curated set.

Your output should match this quality bar, adapted to the actual brief you receive. Do NOT copy Voltline's specifics (Perth, electrician, 2-hour response, named suburbs, EC10437) into a different business's funnel.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose before or after. The exact shape:

{
  "sections": [
    { "type": string, "data": { ... } }
  ]
}

Rules:
- Output EXACTLY eight sections, in the order specified above (hero, offer, reviews, features, trust, faq, reviews, form).
- The per-section catalog under "Field keys per section" splits each section's fields into COPY and LAYOUT buckets.
- Populate every COPY field with real, specific, on-brand text. Never placeholders, never lorem ipsum.
- DESIGN the page, don't just fill it: pick LAYOUT variants deliberately from each section's allowed enum values so the funnel feels custom-designed (vary alignment, density, structure across sections), and give the page a \`surface\` rhythm — open strong, alternate "default" and "tinted" through the middle, and put high-drama bands ("dark") under trust or reviews. See the surface notes in the field appendix. An omitted key falls back to the default.
- When you specify a layout field, the catalog enumerates the allowed values — pick exactly one of those for each variant key.
- Do NOT output a raw \`theme\` field on any section — free-form colours are discarded. \`surface\` is the colour knob.
- Item arrays (offer.inclusions, offer.items, offer.signals, features.items, trust.items, trust.badges, reviews.items, faq.items) MUST be arrays of objects matching the shape given in the catalog. Every item needs a short unique "id" string (e.g. "feat-1", "rev-2", "faq-1"). Do not emit items as bare strings.
- \`headlineAccent\` / \`titleAccent\` is an OPTIONAL SECOND LINE in the accent colour — never duplicate the headline into it. If no second-line emphasis adds value, leave it empty.
- Honour the brand voice exactly. Length: headlines <= 72 chars, subheadings <= 140 chars, body copy <= 400 chars unless explicitly a paragraph.
- The Industry context block above tells you the customer mindset and conversion levers for this trade. Weave the value-proposition and proof-point patterns into copy naturally — paraphrase, never repeat them verbatim, and never claim a certification the brief does not establish (no "Gas Safe" if we don't know the trade does gas).
- Match the trade's urgency mode from the Industry context. \`emergency-callout\` trades (electrician / plumber / locksmith) lead with response time and same-day framing. \`scheduled\` trades (cleaner / gardener) lead with reliability and easy-to-book framing — never use emergency urgency. \`project\` trades (painter / carpenter / roofer) lead with craft and free-quote framing. \`mixed\` trades lead with whichever the brief emphasises.
- Hrefs: every "Book / Get / Buy" CTA href is "#form". Every "Call" CTA href is "tel:" + the operator's phone if available.
- The \`form\` section's \`fields\` array is built deterministically in code — do NOT output a \`fields\` array on the form section. Populate only \`eyebrow\`, \`heading\`.`;

// =============================================================================
// Step 2 — Qualification
// =============================================================================

const QUALIFICATION_SECTION_PLAN: readonly { type: SectionType; role: string; brief: string }[] = [
  {
    type: 'hero',
    role: 'Reframe — the visitor is one step from booked; reassure and steer.',
    brief:
      'The visitor has already given name + email on the previous step. Headline: a short reframe — "Almost there. Let\'s get you on the schedule." Sub: restate the value the visitor is about to receive in concrete terms. NO new offer copy here; reinforce the existing one. Primary CTA = "Confirm my booking", href "#form".',
  },
  {
    type: 'reviews',
    role: 'Social proof, decision-stage angle — "they actually do what they say".',
    brief:
      'Different angle than the landing page: pick testimonials that focus on what the customer experiences AFTER booking — punctual arrival, fixed-quote held, work tidy, follow-up. If the operator supplied testimonials use them verbatim; otherwise generate 2 specific-feeling reviews (named people, suburb).',
  },
  {
    type: 'features',
    role: 'What happens next — a concrete sequence the visitor can picture.',
    brief:
      'Each item is a step in the visitor\'s near future. 3–4 items. Titles are 3–6 words ("We confirm by SMS", "Local pro calls you", "Fixed quote on site"). Descriptions are 1 sentence on what that step looks like and the time it takes. Pick icons (clock, message, shield-check, wrench, phone).',
  },
  {
    type: 'form',
    role: 'Qualify — phone, location, date, time-of-day, budget.',
    brief:
      'The form\'s actual `fields[]` array (phone, address, date, time, budget) is built deterministically in code. Do NOT output a `fields` array on the form section. Your job is the heading band copy only (eyebrow, heading). Heading: action + outcome (e.g. "Lock in your callout"); frame the form as "the final 30 seconds".',
  },
];

const QUALIFICATION_SYSTEM_PROMPT = `You are a direct-response copywriter writing the SECOND step of a two-step lead-capture funnel for a small service business (trades).

The visitor has already given name + email on the previous step. The job of this page is to REINFORCE the booking decision and qualify the lead with a short follow-up form. No new offer, no new pitch — this is the homestretch.

# How this page works

1. Reassure: the visitor has already converted once; do not re-sell. Reframe their position ("you're almost booked") and steer them to finish.
2. Pre-empt the regret moment. People who hand over name + email often hesitate on the next step ("am I really doing this?"). The reviews + the what-happens-next features answer that hesitation specifically.
3. The features section is NOT marketing — it is a literal sequence of what the visitor will experience next. Concrete steps.
4. The form here qualifies the booking — phone, service address, preferred date, preferred time of day (morning / afternoon / evening), budget. Field UI is wired in code; you write the heading band.
5. No corporate-speak. Banned words: comprehensive, leverage, elevate, transform, solutions, premium quality, world-class, industry-leading, innovative, seamless, robust, synergy, cutting-edge, best-in-class, trusted partner, discerning.
6. Use ONLY the testimonials the operator supplied verbatim. NEVER invent quoted testimonials with fake author names if the operator supplied any. If none were supplied, generate credible specific-feeling reviews (named people, suburb, concrete detail).

# Section plan (you MUST output sections in this exact order)

${QUALIFICATION_SECTION_PLAN.map((s, i) => `${i + 1}. ${s.type}\n   Role: ${s.role}\n   ${s.brief}`).join('\n\n')}

# Worked example (Voltline Electrical — emergency callout funnel, step 2)

Anchor brief: same Voltline Electrical funnel as step 1 (the same chosen offer is in play; the visitor has just given their name + email and landed here). Voice: casual-but-credible, urgency 3/5.

A high-quality step-2 qualification page for that brief:

\`\`\`json
{
  "sections": [
    {
      "type": "hero",
      "data": {
        "layout": "split",
        "contentAlign": "left",
        "headlineSize": "l",
        "eyebrow": "// ONE MORE STEP",
        "headline": "Almost there. Let's lock in your callout.",
        "headlineAccent": "30 seconds to confirm.",
        "sub": "We've got your name and email. A few more details below — the address, when you'd like us there, and the rough budget — and we'll have an electrician on the way.",
        "ctaPrimaryLabel": "Confirm my booking",
        "ctaPrimaryHref": "#form"
      }
    },
    {
      "type": "reviews",
      "data": {
        "layout": "grid",
        "columns": 2,
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// AFTER THE CALL",
        "headline": "What actually happens after you confirm.",
        "items": [
          {
            "id": "rev-1",
            "quote": "Confirmation SMS hit my phone the second I hit submit. Mark called within ten minutes to confirm the address. The van was on my street within the hour. Exactly what he said would happen.",
            "authorName": "Priya S.",
            "authorRole": "Claremont",
            "rating": 5
          },
          {
            "id": "rev-2",
            "quote": "Fixed quote on the spot, work done while we ate dinner. The total on the invoice was the total I'd been quoted — no \\"oh I also had to do\\" extras. That alone is rare in this town.",
            "authorName": "David T.",
            "authorRole": "Cottesloe",
            "rating": 5
          }
        ]
      }
    },
    {
      "type": "features",
      "data": {
        "layout": "cards",
        "mediaStyle": "icon",
        "iconStyle": "soft",
        "columns": 4,
        "headerAlign": "center",
        "headlineSize": "m",
        "eyebrow": "// WHAT HAPPENS NEXT",
        "headline": "Four steps. Roughly two hours from now.",
        "items": [
          {
            "id": "step-1",
            "icon": "message",
            "title": "Confirmation SMS",
            "description": "You'll get a text confirming your details within 60 seconds. No surprises."
          },
          {
            "id": "step-2",
            "icon": "phone",
            "title": "Mark calls back",
            "description": "Within 10 minutes, the on-call electrician calls to confirm the address and the nature of the fault."
          },
          {
            "id": "step-3",
            "icon": "circle-check",
            "title": "Fixed quote on site",
            "description": "Electrician arrives, diagnoses, writes the price down, and only starts when you sign off."
          },
          {
            "id": "step-4",
            "icon": "shield-check",
            "title": "Work done, paperwork lodged",
            "description": "Job finished, certificate emailed the next morning, paperwork sent to Western Power if it's needed."
          }
        ]
      }
    },
    {
      "type": "form",
      "data": {
        "eyebrow": "// FINAL 30 SECONDS",
        "heading": "Lock in your callout"
      }
    }
  ]
}
\`\`\`

What this example demonstrates:
- The hero does NOT re-pitch the offer — it reframes the visitor's position ("almost there") and steers them to finish. \`headlineAccent\` is a second line ("30 seconds to confirm.") — not a duplicate.
- Reviews are picked for the decision-stage angle: punctual arrival, fixed-quote held, work tidy. Different testimonials than step 1 (Priya / David, not Sarah / James).
- The features section is a LITERAL sequence the visitor will experience next — four concrete steps, not marketing-speak. Each title is 3–5 words; each description is one sentence on what that step looks like.
- Icons (message, phone, circle-check, shield-check) come from the curated set and match each step.
- The \`form\` section has only \`eyebrow\` + \`heading\` — NO \`fields\` array.
- No new offer copy. No re-sell. The page assumes the visitor already wants the service.

Your output should match this quality bar, adapted to the actual brief you receive. Do NOT copy Voltline's specifics into a different business's funnel.

# Output contract

Return ONLY a single JSON object — no markdown fences, no commentary, no prose:

{
  "sections": [
    { "type": string, "data": { ... } }
  ]
}

Rules:
- Output EXACTLY four sections, in the order specified above (hero, reviews, features, form).
- The per-section catalog under "Field keys per section" splits each section's fields into COPY and LAYOUT buckets.
- Populate every COPY field with real, specific, on-brand text. Never placeholders, never lorem ipsum.
- Pick LAYOUT variants deliberately from each section's allowed enum values, and use \`surface\` sparingly here — this page is the homestretch; one "tinted" or "dark" band for the reviews is plenty. An omitted key falls back to the default.
- When you specify a layout field, the catalog enumerates the allowed values — pick exactly one of those for each variant key.
- Do NOT output a raw \`theme\` field on any section — free-form colours are discarded. \`surface\` is the colour knob.
- Item arrays (reviews.items, features.items) MUST be arrays of objects matching the shape given in the catalog. Every item needs a short unique "id" string.
- \`headlineAccent\` / \`titleAccent\` is an OPTIONAL SECOND LINE in the accent colour — never duplicate the headline into it. Leave empty when no second-line emphasis adds value.
- Honour the brand voice. Headlines <= 72 chars; subheadings <= 140; body copy <= 400.
- The Industry context block above tells you the customer mindset and conversion levers for this trade. Weave its value-proposition and proof-point patterns into copy naturally — paraphrase, never repeat them verbatim. Never claim a certification the brief does not establish.
- Match the trade's urgency mode from the Industry context. \`emergency-callout\` trades reinforce response-time framing; \`scheduled\` trades reinforce reliability and easy-to-book; \`project\` trades reinforce craft and process honesty.
- Hrefs: any CTA href is "#form".
- The \`form\` section's \`fields\` array is built deterministically in code — do NOT output a \`fields\` array. Populate only \`eyebrow\`, \`heading\`.`;

// =============================================================================
// Public entry points
// =============================================================================

export type FunnelStepResult = {
  sections: Section[];
  fallbackLog: FallbackLogEntry[];
};

type LiveBrief = {
  brand: BrandObject;
  funnel: FunnelBrief;
  phone: string;
  serviceArea: string;
  industry: string;
  businessName: string;
  /** Optional — when conversational onboarding resolved AI knowledge for
   *  this signup, the funnel user message gets an extra subblock with the
   *  customer-pain + desired-outcome + voice signals. Absent on the
   *  operator concierge path; the prompt's existing industry-template
   *  block still carries enough context for credible copy. */
  industryKnowledge?: {
    services: string[];
    trustSignals: string[];
    customerPainPoints: string[];
    desiredOutcomes: string[];
    voiceRecommendation: string;
    source: 'ai' | 'template' | 'fallback';
  };
};

/** Step 1 — generate the 8-section lead-capture landing (Suby/Sultanic + FAQ). */
export async function generateFunnelLandingLive(
  brief: LiveBrief,
  generationId: string = crypto.randomUUID(),
): Promise<FunnelStepResult> {
  return runFunnelGeneration(brief, generationId, {
    systemPrompt: LEAD_CAPTURE_SYSTEM_PROMPT,
    expectedTypes: ['hero', 'offer', 'reviews', 'features', 'trust', 'faq', 'reviews', 'form'],
    introNote:
      'Write step 1 — the lead-capture page. Eight sections. The form captures NAME + EMAIL ONLY; the hero ALSO carries the same name+email form via the section envelope.',
    formBuilder: (b) => buildLeadCaptureFormConfig(b.funnel),
    attachHeroFormEnvelope: true,
  });
}

/** Step 2 — generate the 4-section qualification page. */
export async function generateFunnelQualificationLive(
  brief: LiveBrief,
  generationId: string = crypto.randomUUID(),
): Promise<FunnelStepResult> {
  return runFunnelGeneration(brief, generationId, {
    systemPrompt: QUALIFICATION_SYSTEM_PROMPT,
    expectedTypes: ['hero', 'reviews', 'features', 'form'],
    introNote:
      'Write step 2 — the qualification page. Four sections. The form captures phone, service address, preferred date, preferred time-of-day, and budget; the field UI is wired in code — write the heading band copy only.',
    formBuilder: () => buildQualificationFormConfig(),
    attachHeroFormEnvelope: false,
  });
}

// =============================================================================
// Shared call + assembly
// =============================================================================

type RunConfig = {
  systemPrompt: string;
  expectedTypes: readonly SectionType[];
  introNote: string;
  formBuilder: (brief: LiveBrief) => FormConfig;
  /** Step 1 only — attach the same lead-capture form to the hero section so
   *  the visitor can convert above the fold without scrolling. */
  attachHeroFormEnvelope: boolean;
};

async function runFunnelGeneration(
  brief: LiveBrief,
  generationId: string,
  cfg: RunConfig,
): Promise<FunnelStepResult> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

  const userMessage = composeUserMessage(brief, cfg);

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    // Opus 4.7 requires `adaptive` thinking (rejects enabled+budget).
    thinking: { type: 'adaptive' },
    system: [
      { type: 'text', text: cfg.systemPrompt, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });
  const message = await stream.finalMessage();

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  const raw = parseFunnelResponse(text);
  return validateAndAssemble(raw, brief, generationId, cfg);
}

// -- Prompt composition -----------------------------------------------------

function composeUserMessage(brief: LiveBrief, cfg: RunConfig): string {
  const offer = brief.funnel.offer;
  const offerBlock = offer
    ? [
        '## Chosen offer (drives the funnel — use these strings as authoritative)',
        '',
        `Headline: ${offer.headline}`,
        `Promise: ${offer.promise}`,
        `Risk reversal: ${offer.riskReversal}`,
        `CTA text: ${offer.ctaText}`,
      ].join('\n')
    : [
        '## Chosen offer',
        '',
        '(none supplied — compose a credible offer from the funnel brief below; lead with the customer pain and promise.)',
      ].join('\n');

  const testimonials = (brief.funnel.testimonials ?? []).filter(isUsableTestimonial);
  const tBlock =
    testimonials.length > 0
      ? [
          '## Testimonials (use these VERBATIM)',
          '',
          ...testimonials.map(
            (t, i) =>
              `${i + 1}. "${t.quote}"\n   — ${t.author}${t.context ? ` (${t.context})` : ''}`,
          ),
        ].join('\n')
      : [
          '## Testimonials',
          '',
          '(none supplied — generate credible specific reviews for the social-proof sections; named people, suburb, concrete detail.)',
        ].join('\n');

  return [
    cfg.introNote,
    '',
    `## Business`,
    '',
    `Name: ${brief.businessName || '(unnamed)'}`,
    `Industry: ${brief.industry || brief.brand.industryCategory}`,
    `Service area: ${brief.serviceArea || '(not specified)'}`,
    `Phone: ${brief.phone || '(not provided — omit phone-CTA fields)'}`,
    '',
    `## Brand`,
    '',
    `Audience: ${brief.brand.audienceLine}`,
    `Voice: ${voiceToneToProse(brief.brand.voice)}`,
    brief.brand.topJobsToBeBooked.length > 0
      ? `Top jobs: ${brief.brand.topJobsToBeBooked.join('; ')}`
      : '',
    '',
    `## Industry context`,
    '',
    renderIndustryPromptBlock(
      resolveIndustryTemplate(brief.industry || brief.brand.industryCategory),
    ),
    '',
    ...(brief.industryKnowledge ? buildIndustryKnowledgeSubblock(brief.industryKnowledge) : []),
    `## Funnel brief`,
    '',
    `Service this funnel sells: ${brief.funnel.service || '(not specified)'}`,
    `Customer pain (what makes them urgently search): ${brief.funnel.customerPain || '(not specified)'}`,
    `Guarantee the business will stand behind: ${brief.funnel.guarantee || '(not specified)'}`,
    '',
    offerBlock,
    '',
    tBlock,
    '',
    `## Field keys per section`,
    '',
    buildFieldKeysBlock(cfg.expectedTypes),
    '',
    'Write the page.',
  ]
    .filter((s) => s !== '')
    .join('\n');
}

/** Compose the optional "AI-resolved industry knowledge" subblock that
 *  rides into the funnel user message when the conversational onboarding
 *  fetched it. Returns an array of lines so the caller can spread it into
 *  the larger composition; returns empty when absent so the spread is a
 *  no-op. Same shape the website prompt uses (generation-prompt.ts) — the
 *  two paths emit parallel knowledge blocks so Sonnet/Opus see consistent
 *  context across page + funnel generation for the same business. */
function buildIndustryKnowledgeSubblock(
  k: NonNullable<LiveBrief['industryKnowledge']>,
): string[] {
  const painList =
    k.customerPainPoints.length > 0
      ? k.customerPainPoints.map((p) => `  - ${p}`).join('\n')
      : '  (none captured)';
  const outcomeList =
    k.desiredOutcomes.length > 0
      ? k.desiredOutcomes.map((o) => `  - ${o}`).join('\n')
      : '  (none captured)';
  const trustList =
    k.trustSignals.length > 0
      ? k.trustSignals.slice(0, 8).join(', ')
      : '(none captured)';
  const sourceNote =
    k.source === 'ai'
      ? 'Resolved by an AI knowledge call for this specific industry — treat as authoritative.'
      : k.source === 'template'
        ? 'Derived from the curated industry template — reliable but generic.'
        : 'Safe defaults — generic service-business shape.';
  return [
    `## Industry knowledge (resolved live for this business)`,
    '',
    `Source: ${sourceNote}`,
    '',
    'Customer pain points (what brings them to this trade):',
    painList,
    '',
    'Desired outcomes (what success looks like to them):',
    outcomeList,
    '',
    `Trust signals customers look for: ${trustList}`,
    '',
    `Voice recommendation for this trade: ${k.voiceRecommendation || '(none captured)'}`,
    '',
    'Weave these pain points + outcomes into headlines, subheadings, and CTAs naturally — never repeat verbatim.',
    '',
  ];
}

function buildFieldKeysBlock(types: readonly SectionType[]): string {
  // De-dupe — `reviews` may appear twice in the lead-capture plan.
  const seen = new Set<SectionType>();
  const blocks: string[] = [SHARED_FIELD_NOTES];
  for (const t of types) {
    if (seen.has(t)) continue;
    seen.add(t);
    const entry = formatSectionShape(t);
    if (entry) blocks.push(entry);
  }
  return blocks.join('\n\n');
}

function isUsableTestimonial(t: FunnelTestimonial): boolean {
  return Boolean(t && t.quote && t.quote.trim() && t.author && t.author.trim());
}

// -- Defensive parsing ------------------------------------------------------

type RawSection = { type?: unknown; data?: unknown };
type RawFunnel = { sections?: unknown };

function parseFunnelResponse(text: string): RawSection[] {
  let body = text.trim();
  if (body.startsWith('```')) {
    body = body.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('generate-funnel-live: model response contained no JSON object');
  }
  const parsed = JSON.parse(body.slice(start, end + 1)) as RawFunnel;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sections)) {
    throw new Error('generate-funnel-live: model response missing sections array');
  }
  return parsed.sections as RawSection[];
}

// -- Validation + assembly --------------------------------------------------

function validateAndAssemble(
  rawSections: RawSection[],
  brief: LiveBrief,
  generationId: string,
  cfg: RunConfig,
): FunnelStepResult {
  const fallbackLog: FallbackLogEntry[] = [];
  const out: Section[] = [];
  let heroEnvelopeAttached = false;
  const formConfig = cfg.formBuilder(brief);
  const industry = resolveIndustryString({
    industry: brief.industry,
    brand: { industryCategory: brief.brand.industryCategory },
  });

  for (const raw of rawSections) {
    if (typeof raw?.type !== 'string') continue;
    // Pass A0 — deprecated-section coercion (Bundle C2b-3). Same rule the
    // website pipeline runs. The funnel prompt's catalog is also filtered
    // through `isEligible`, so this is a defence-in-depth pass for models
    // that have seen the old vocabulary in training.
    const rawData: Record<string, unknown> =
      typeof raw.data === 'object' && raw.data !== null
        ? { ...(raw.data as Record<string, unknown>) }
        : {};
    const coerced = coerceDeprecatedSection(raw.type as SectionType, rawData);
    for (const fb of coerced.fallbacks) fallbackLog.push({ generationId, ...fb });
    const type = coerced.type;
    const meta = getSectionMeta(type);
    if (!meta || !meta.allowedContainers.includes('funnelStep')) continue;

    let data: Record<string, unknown> = coerced.data;

    // Pass A — theme-discard guard. Free-form per-section theme overrides
    // fight the brand palette; strip them so brand defaults apply uniformly.
    if ('theme' in data) {
      const modelValue = data.theme;
      delete data.theme;
      fallbackLog.push({
        generationId,
        sectionType: type,
        fieldName: 'theme',
        reason: 'invalid',
        modelValue,
      });
    }

    // Pass A+ — surface macro (the art-director pass). The model's sanctioned
    // closed-set colour knob; maps to contrast-safe theme overrides from the
    // brand accent. See `applySurfaceChoice`.
    const surfacePass = applySurfaceChoice(type, data, brief.brand.accentColor);
    data = surfacePass.data;
    for (const fb of surfacePass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
    }

    // Pass B — enum validation. Substitute invalid enum values with the
    // catalog's first listed value; log the rejected value.
    const enumPass = validateEnums(type, data);
    data = enumPass.data;
    for (const fb of enumPass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
    }

    // Pass B+ — bundle-aware variant assignment (Bundle C2b-2). The brand's
    // design bundle may carry `variantRules` that narrow the allowable set
    // of variant values per (section, page-type) tuple. Funnel steps run as
    // the `funnelStep` page-type context.
    const bundle = getBundle(brief.brand.designBundleId);
    const variantPass = assignBundleVariants(
      type,
      data,
      bundle,
      'funnelStep',
      generationId,
    );
    data = variantPass.data;
    for (const fb of variantPass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
    }

    // Pass B++ — trust V3 single-word enforcement (Bundle C2b-3).
    const trustPass = enforceTrustCompactSingleWord(type, data);
    data = trustPass.data;
    for (const fb of trustPass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
    }

    // Pass C — hallucinated image-path strip.
    const stripPass = stripHallucinatedImages(type, data);
    data = stripPass.data;
    for (const fb of stripPass.fallbacks) {
      fallbackLog.push({ generationId, ...fb });
    }

    // Pass D — stock-image injection. Funnel brief has both `industry`
    // and `brand.industryCategory`; the resolver picks whichever is set.
    // C1: pass `surface: 'funnel'` + the business-name seed so the funnel
    // hero never lands on the same photo as the site hero of the same
    // customer (the helper excludes the template's headline `hero` URL
    // from the funnel hero pool, picking from gallery only).
    // Bundle C2b-2 skip-list: image-free variants (hero `layout: 'minimal'`,
    // contact `layout: 'minimal-cta'`) bypass injection entirely.
    if (!shouldSkipStockImageInjection(type, data)) {
      const injectPass = injectStockImages(type, data, industry, {
        slug: brief.businessName?.trim() || undefined,
        surface: 'funnel',
      });
      data = injectPass.data;
      for (const fb of injectPass.fallbacks) {
        fallbackLog.push({ generationId, ...fb });
      }
    }

    // Pass E — items/columns reconciliation.
    data = reconcileColumns(type, data);

    // Pass F — missing-field reporting (runs LAST so injected /
    // substituted fields aren't double-flagged as missing).
    for (const key of meta.defaultDataKeys) {
      const v = data[key];
      if (v === undefined || v === null) {
        fallbackLog.push({
          generationId,
          sectionType: type,
          fieldName: key,
          reason: 'missing',
        });
      }
    }

    const populatedFields = Object.keys(data).filter((k) => data[k] != null);
    const section: Section = {
      id: `sec-${Math.random().toString(36).slice(2, 9)}`,
      type,
      enabled: true,
      data,
      ai: { draftedFields: populatedFields, lastRegenAt: new Date().toISOString() },
    };

    if (type === 'form') {
      section.form = formConfig;
    } else if (type === 'hero' && cfg.attachHeroFormEnvelope && !heroEnvelopeAttached) {
      // Step-1 only: attach the SAME lead-capture form to the hero so the
      // visitor can convert above the fold. The `form` section type at the
      // bottom carries the same config — both forms feed the same lead.
      section.form = formConfig;
      heroEnvelopeAttached = true;
    }

    out.push(section);
  }

  return { sections: out, fallbackLog };
}

// =============================================================================
// Form-config builders
// =============================================================================

/** Step 1: name + email only. Submit label = offer.ctaText when available. */
function buildLeadCaptureFormConfig(funnel: FunnelBrief): FormConfig {
  const name: FormField = {
    id: makeFieldId(),
    type: 'text',
    label: 'Your name',
    required: true,
    placeholder: 'Your name',
    leadRole: 'name',
  };
  const email: FormField = defaultFormField('email');
  email.required = true;
  const submitLabel = funnel.offer?.ctaText?.trim() || 'Get started';
  return {
    title: 'Get in touch',
    showTitle: false,
    submitLabel,
    fields: [name, email],
    afterSubmit: { kind: 'nextStep' },
    colors: {},
  };
}

/** Step 2: phone + service address + preferred date + time-of-day + budget. */
function buildQualificationFormConfig(): FormConfig {
  const phone: FormField = defaultFormField('phone');
  phone.required = true;

  const address: FormField = {
    id: makeFieldId(),
    type: 'text',
    label: 'Service address',
    required: true,
    placeholder: 'Where should we come?',
    // Tagged so the route's existing-lead branch persists this onto
    // customers.address — without the tag the value would only land in
    // lead_events.payload (FIX A).
    leadRole: 'address',
  };

  const preferredDate: FormField = {
    id: makeFieldId(),
    type: 'date',
    label: 'Preferred date',
    required: false,
  };

  const timeOfDay: FormField = {
    id: makeFieldId(),
    type: 'select',
    label: 'Preferred time of day',
    required: false,
    placeholder: 'Pick a window',
    options: ['Morning', 'Afternoon', 'Evening'],
  };

  const budget: FormField = {
    id: makeFieldId(),
    type: 'select',
    label: 'Budget',
    required: false,
    placeholder: 'Ballpark',
    options: ['Under $500', '$500–$2,000', '$2,000–$10,000', '$10,000+', 'Not sure yet'],
  };

  return {
    title: 'Lock in your callout',
    showTitle: false,
    submitLabel: 'Confirm my booking',
    fields: [phone, address, preferredDate, timeOfDay, budget],
    afterSubmit: { kind: 'nextStep' },
    colors: {},
  };
}
