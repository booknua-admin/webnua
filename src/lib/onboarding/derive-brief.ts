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
import { resolveIndustryTemplate } from '@/lib/website/industry-templates';
import type { BrandObject, VoiceToneAxis } from '@/lib/website/types';

import { INDUSTRY_PRIMARY_COLORS, deriveSecondaryColor } from './industry-colors';
import type { WizardState } from './types';

export type DeriveBriefInput = {
  state: WizardState;
  /** Signup-time fallbacks. The wizard's step 2 overrides these; if step 2
   *  was skipped, the original signup values flow through. */
  fallbackBusinessName: string;
  fallbackEmail: string;
  fallbackIndustry: string;
};

/** Derive a `ClientBrief` from the wizard state. Used twice: once at step 4
 *  completion to fire background website + funnel generation, and once at
 *  step 7 if the customer re-triggers generation (e.g. after a failure).
 *
 *  The wizard's step 1 is required, so `industryKey` is always present.
 *  Every other step is optional — defaults flow through from the industry
 *  template + the signup fallbacks. */
export function deriveBriefFromWizard(input: DeriveBriefInput): ClientBrief {
  const { state, fallbackBusinessName, fallbackEmail, fallbackIndustry } = input;
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
  const voice = step4
    ? toneToVoice(step4.tone)
    : {
        formality: 3 as VoiceToneAxis,
        urgency: 3 as VoiceToneAxis,
        technicality: 3 as VoiceToneAxis,
      };
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
      offer: null, // wizard doesn't run the four-field offer generator
      //                  (operator-concierge path does; wizard skips for speed)
    },
  };
}

// --- internals --------------------------------------------------------------

function toneToVoice(tone: 'friendly' | 'professional' | 'casual'): {
  formality: VoiceToneAxis;
  urgency: VoiceToneAxis;
  technicality: VoiceToneAxis;
} {
  // VoiceToneAxis is the literal union 1|2|3|4|5. Inline literals would
  // widen to `number` through the switch return, so we type each return
  // explicitly through the alias.
  switch (tone) {
    case 'friendly':
      return { formality: 2 as VoiceToneAxis, urgency: 2 as VoiceToneAxis, technicality: 2 as VoiceToneAxis };
    case 'professional':
      return { formality: 4 as VoiceToneAxis, urgency: 2 as VoiceToneAxis, technicality: 3 as VoiceToneAxis };
    case 'casual':
      return { formality: 1 as VoiceToneAxis, urgency: 3 as VoiceToneAxis, technicality: 2 as VoiceToneAxis };
  }
}

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
