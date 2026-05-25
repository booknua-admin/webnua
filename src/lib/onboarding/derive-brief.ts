// =============================================================================
// onboarding/derive-brief — convert the wizard state into a ClientBrief the
// generators (generateSiteStub / generateFunnelStub) consume.
//
// The wizard captures industry / business / target / brand / testimonials /
// integrations — but `generateFunnelStub` also requires `funnel.service` +
// `funnel.customerPain` + `funnel.guarantee`. Per the locked plan, those
// are DERIVED from existing wizard data rather than asked separately:
//
//   funnel.service       ← step1.services[0] OR industryTemplate.defaultServices[0]
//   funnel.customerPain  ← step3.targetCustomer framed as urgency moment
//                          (industry template's contextForModel gives shape)
//   funnel.guarantee     ← step3.usp OR industryTemplate.objectionHandlers[0].response
//
// Generators tolerate empty strings gracefully (the funnel renders a
// neutral default), so a skipped step never breaks generation — it just
// produces less-specific copy.
//
// This module is PURE (no I/O). Test-friendly + safe to call from any
// surface that has the wizard state + the signup-time brand row.
// =============================================================================

import type { ClientBrief } from '@/lib/website/site-generation-stub';
import {
  resolveIndustryTemplate,
  type IndustryKey,
} from '@/lib/website/industry-templates';
import type { BrandObject } from '@/lib/website/types';

import type { ConversationCapturedFacts } from './conversation-types';
import { INDUSTRY_PRIMARY_COLORS, deriveSecondaryColor } from './industry-colors';
import type { WizardState } from './types';
import { NEUTRAL_VOICE, toneToVoice } from './voice-presets';
import type { FunnelOffer } from '@/lib/website/offer-generate';

export type DeriveBriefInput = {
  state: WizardState;
  /** Signup-time fallbacks. The wizard's step 2 overrides these; if step 2
   *  was skipped, the original signup values flow through. */
  fallbackBusinessName: string;
  fallbackEmail: string;
  fallbackIndustry: string;
  /** Optional pre-generated four-field funnel offer. The wizard fires the
   *  Sonnet-backed offer generator alongside site + funnel generation when
   *  step 4 commits (Phase 2 parity fix); the resolved offer is injected
   *  here so the funnel persistence writes it to `funnels.funnel_offer`.
   *  Null when the call failed (the wizard surfaces a warning + the
   *  customer can run it manually from the editor later) or skipped. */
  offerOverride?: FunnelOffer | null;
};

/** Derive a `ClientBrief` from the wizard state. Used twice: once at step 4
 *  completion to fire background website + funnel generation, and once at
 *  step 7 if the customer re-triggers generation (e.g. after a failure).
 *
 *  The wizard's step 1 is required, so `industryKey` is always present.
 *  Every other step is optional — defaults flow through from the industry
 *  template + the signup fallbacks. */
export function deriveBriefFromWizard(input: DeriveBriefInput): ClientBrief {
  const { state, fallbackBusinessName, fallbackEmail, fallbackIndustry, offerOverride } = input;
  const { step1, step2, step3, step4, step5 } = state.step_data;

  // Step 1 is required — but guard defensively so a corrupted state doesn't
  // crash generation; we fall back to the signup-time industry string.
  const industry = step1?.industryFreeText?.trim() || step1?.industryKey || fallbackIndustry;
  const template = resolveIndustryTemplate(industry);

  // Services + trust signals: step 1's edited lists, falling back to the
  // template defaults if step 1 was somehow incomplete.
  const services =
    step1?.services && step1.services.length > 0
      ? step1.services
      : [...template.defaultServices];

  // Business basics — step 2 overrides; otherwise the signup values + safe
  // empties. `ownerName` has no signup source, so it stays empty unless
  // step 2 supplied one (it doesn't in the current step 2 schema, but the
  // BusinessDetails shape requires the field). The generator handles
  // empty `ownerName` by omitting the "I'm X" copy variants.
  const businessName = step2?.businessName?.trim() || fallbackBusinessName;
  const businessEmail = fallbackEmail; // wizard intentionally doesn't edit the email
  const business = {
    name: businessName,
    ownerName: '',
    phone: step2?.phone?.trim() || '',
    email: businessEmail,
    serviceArea: step2?.serviceArea?.trim() || '',
    offer: step3?.usp?.trim() || step3?.startingPriceFraming?.trim() || '',
    services,
  };

  // Brand — step 4 overrides; otherwise the industry-default colour + a
  // derived secondary. Voice axes resolve from the tone preset (step 4) or
  // the neutral midpoint (3/3/3 — what signup seeded). Audience line +
  // industry category surface on the placeholder brand row from signup;
  // wizard's step 3 `targetCustomer` is a richer fit for audienceLine
  // when present.
  const primaryColor =
    step4?.primaryColor?.trim() ||
    INDUSTRY_PRIMARY_COLORS[template.key] ||
    INDUSTRY_PRIMARY_COLORS.generic;
  const secondaryColor =
    step4?.secondaryColor?.trim() || deriveSecondaryColor(primaryColor);
  const voice = step4 ? toneToVoice(step4.tone) : NEUTRAL_VOICE;
  const brand: BrandObject = {
    accentColor: primaryColor,
    brandColors: [primaryColor, secondaryColor].filter(Boolean),
    logoUrl: step4?.logoUrl ?? null,
    faviconUrl: null,
    voice,
    audienceLine: step3?.targetCustomer?.trim() || '',
    industryCategory: industry,
    topJobsToBeBooked: services.slice(0, 3),
  };

  // Funnel brief — derived per the locked plan. service = first listed
  // service; customerPain = the customer-cohort + urgency mode framing;
  // guarantee = USP or the first objection-handler response from the
  // industry template.
  const funnelService = services[0] || template.defaultServices[0] || 'Get in touch for a quote';
  const funnelCustomerPain = composeFunnelCustomerPain({
    targetCustomer: step3?.targetCustomer ?? '',
    urgencyMode: template.urgencyMode,
    industryDisplay: template.displayName,
  });
  const funnelGuarantee =
    step3?.usp?.trim() ||
    template.objectionHandlers[0]?.response ||
    'Fixed-price quote before any work starts.';

  const testimonials = (step5?.testimonials ?? []).map((t) => ({
    quote: t.quote,
    author: t.author,
    context: t.context,
  }));

  return {
    business,
    industry,
    brand,
    primaryIntent: derivePrimaryIntent(template.urgencyMode),
    audience: 'mixed', // wizard captures who but not the cohort axis;
    //                                'mixed' is the conservative default the
    //                                template's contextForModel already covers
    funnel: {
      service: funnelService,
      customerPain: funnelCustomerPain,
      guarantee: funnelGuarantee,
      testimonials,
      // The wizard now fires the Sonnet-backed offer generator alongside
      // site + funnel generation (Phase 2 parity fix) — when it resolves
      // the caller injects the result via `offerOverride`. Null means
      // either the wizard is calling pre-generation (the deriver is run
      // twice: once to feed offer-gen its inputs, once with the result)
      // OR the offer call failed (the funnel publishes without one — the
      // operator can run it later from the editor).
      offer: offerOverride ?? null,
    },
  };
}

// =============================================================================
// Conversational-onboarding sibling
// =============================================================================
//
// Same return shape as deriveBriefFromWizard, different input source: the
// conversational flow's capturedFacts (turns 1-4) + the AI extraction.
// Sibling not generalised — the input shapes genuinely differ (wizard has
// step3 targetCustomer + step4 voice preset; conversation has extraction +
// no explicit target/voice capture), and forcing a shared deriver would
// add a translation layer per call site. Two clean siblings per the
// CLAUDE.md "siblings beat conditional optional fields" pattern.

export type DeriveBriefFromConversationInput = {
  /** Everything captured across turns 1-4 (extraction, services, brand,
   *  offer). Each section is optional — a customer who skipped a turn
   *  falls through to industry-template defaults. */
  capturedFacts: ConversationCapturedFacts;
  /** The customer's verified signup email — used as `business.email`.
   *  The conversation flow does NOT capture a different email (turn 1
   *  asks for the verification email; that's the only one we have). */
  email: string;
  /** Display name from `clients.name` (set at signup from the business
   *  name the customer typed). Used as `business.name` when the
   *  extraction did not surface a different one. */
  fallbackBusinessName: string;
};

/** Convert conversational capturedFacts into a `ClientBrief` the
 *  generators consume. Called by the conversation shell's turn-5 handoff
 *  before invoking `runConversationGeneration`. */
export function deriveBriefFromConversation(
  input: DeriveBriefFromConversationInput,
): ClientBrief {
  const { capturedFacts: facts, email, fallbackBusinessName } = input;

  // Business name resolution order (most specific → least): the AI-extracted
  // name kept on capturedFacts.businessName → the extraction's own field →
  // the signup-time placeholder fallback. The conversation shell writes
  // `businessName` onto capturedFacts as soon as the extraction lands with
  // sufficient confidence, so by turn-5 generation the right name is there.
  const businessName =
    facts.businessName?.trim() ||
    facts.extraction?.businessName?.trim() ||
    fallbackBusinessName;

  // The extraction is the conversation's anchor — turn 1 + clarifying-
  // question loop produced it. A missing extraction means a customer
  // somehow reached turn 5 without one; fall back to generic so
  // generation still runs (the template carries safe defaults).
  const industry: IndustryKey = facts.extraction?.industry ?? 'generic';
  const template = resolveIndustryTemplate(industry);
  const industryDisplay =
    facts.extraction?.industryFreeText?.trim() || template.displayName;

  // Services — turn 2's customer-edited list, falling back to the
  // template's defaults when turn 2 was skipped.
  const services =
    facts.services && facts.services.length > 0
      ? facts.services
      : [...template.defaultServices];

  // Brand — turn 3's customer-picked colour + logo, falling back to the
  // industry default + a derived secondary. Voice axes stay at neutral —
  // the conversation flow does NOT capture a tone preset (skipped from
  // the prompt's locked turn list); the brand row is written separately
  // in turn 3 with the colours but voice stays at signup's 3/3/3.
  const primaryColor =
    facts.brand?.primaryColor?.trim() ||
    INDUSTRY_PRIMARY_COLORS[template.key] ||
    INDUSTRY_PRIMARY_COLORS.generic;
  const secondaryColor =
    facts.brand?.secondaryColor?.trim() || deriveSecondaryColor(primaryColor);
  const brand: BrandObject = {
    accentColor: primaryColor,
    brandColors: [primaryColor, secondaryColor].filter(Boolean),
    logoUrl: facts.brand?.logoUrl ?? null,
    faviconUrl: null,
    voice: NEUTRAL_VOICE,
    audienceLine: facts.extraction?.specialty?.trim() || '',
    industryCategory: industryDisplay,
    topJobsToBeBooked: services.slice(0, 3),
  };

  // Funnel brief — derive from extraction + industry template, same shape
  // as the wizard.
  const funnelService = services[0] || template.defaultServices[0] || 'Get in touch for a quote';
  const funnelCustomerPain = composeConversationCustomerPain({
    specialty: facts.extraction?.specialty ?? '',
    urgencyMode: template.urgencyMode,
    industryDisplay: template.displayName,
  });
  const funnelGuarantee =
    template.objectionHandlers[0]?.response ||
    'Fixed-price quote before any work starts.';

  // Offer — turn 4's accepted offer (snake_case in capturedFacts; the
  // brief carries camelCase). Null when the customer chose Skip.
  const offer: FunnelOffer | null = facts.offer
    ? {
        headline: facts.offer.headline,
        promise: facts.offer.promise,
        riskReversal: facts.offer.risk_reversal,
        ctaText: facts.offer.cta_text,
      }
    : null;

  return {
    business: {
      name: businessName,
      ownerName: '',
      phone: '',
      email,
      serviceArea: facts.extraction?.location?.trim() || '',
      offer: '',
      services,
    },
    industry: industryDisplay,
    brand,
    primaryIntent: derivePrimaryIntent(template.urgencyMode),
    audience: 'mixed',
    funnel: {
      service: funnelService,
      customerPain: funnelCustomerPain,
      guarantee: funnelGuarantee,
      testimonials: [],
      offer,
    },
  };
}

function composeConversationCustomerPain(input: {
  specialty: string;
  urgencyMode: 'emergency-callout' | 'scheduled' | 'project' | 'mixed';
  industryDisplay: string;
}): string {
  const audience = input.specialty.trim()
    ? `A customer looking for ${input.specialty.trim()}`
    : 'A customer';
  switch (input.urgencyMode) {
    case 'emergency-callout':
      return `${audience} hits an urgent problem and needs a ${input.industryDisplay.toLowerCase()} on site today.`;
    case 'scheduled':
      return `${audience} wants ${input.industryDisplay.toLowerCase()} work done on a reliable schedule.`;
    case 'project':
      return `${audience} is planning a ${input.industryDisplay.toLowerCase()} project and needs a quote they can trust.`;
    case 'mixed':
      return `${audience} needs ${input.industryDisplay.toLowerCase()} work done — sometimes urgent, sometimes planned.`;
  }
}

// --- internals --------------------------------------------------------------

// PrimaryIntent narrowing: 'other' carries a required `text` field; the
// non-'other' variants are bare. Step 1's urgency-mode map only emits the
// bare variants, but the discriminator forces us to keep the type-narrowed
// shape exact.
function derivePrimaryIntent(
  urgencyMode: 'emergency-callout' | 'scheduled' | 'project' | 'mixed',
): { kind: 'book' } | { kind: 'call' } | { kind: 'quote' } {
  switch (urgencyMode) {
    case 'emergency-callout':
      return { kind: 'call' };
    case 'scheduled':
      return { kind: 'book' };
    case 'project':
      return { kind: 'quote' };
    case 'mixed':
      return { kind: 'book' };
  }
}

/** Compose a urgency-moment sentence for the funnel's pain framing. Combines
 *  the target-customer string + the industry's urgency mode into a clean
 *  one-liner the generator weaves into the funnel hero. */
function composeFunnelCustomerPain(input: {
  targetCustomer: string;
  urgencyMode: 'emergency-callout' | 'scheduled' | 'project' | 'mixed';
  industryDisplay: string;
}): string {
  const audience = input.targetCustomer.trim() || 'A customer';
  switch (input.urgencyMode) {
    case 'emergency-callout':
      return `${audience} hits an urgent problem and needs a ${input.industryDisplay.toLowerCase()} on site today.`;
    case 'scheduled':
      return `${audience} wants ${input.industryDisplay.toLowerCase()} work done on a reliable schedule.`;
    case 'project':
      return `${audience} is planning a ${input.industryDisplay.toLowerCase()} project and needs a quote they can trust.`;
    case 'mixed':
      return `${audience} needs ${input.industryDisplay.toLowerCase()} work done — sometimes urgent, sometimes planned.`;
  }
}
