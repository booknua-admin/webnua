// =============================================================================
// Campaign-template types.
//
// Phase 7 Meta Ads. Each business-category template defines the inputs
// `campaign-launch.ts` needs to call createCampaign → createAdSet →
// createLeadForm → createAdCreative → createAd in one shot.
//
// Templates are SCAFFOLDS — the operator reviews + adjusts targeting,
// copy, and budget before launching. Real Meta interest IDs require a
// live API to validate (the names below are illustrative — replace with
// real ids on first launch).
//
// `{placeholders}` in ad-copy strings are substituted at launch time
// against the client's business facts (substituteCopy in this file).
// =============================================================================

export type CampaignTemplateSlug =
  | 'electrician'
  | 'plumber'
  | 'hvac'
  | 'builder'
  | 'locksmith'
  | 'cleaner'
  | 'landscaper'
  | 'painter'
  | 'other';

export type TargetingSpec = {
  /** ISO country codes — Meta requires at least one. Templates default to
   *  the country in the brief; the operator can broaden / narrow. */
  countries?: string[];
  /** Radius targeting around a lat/lng. The launch flow resolves the
   *  client's service-area centroid + this radius into Meta's
   *  `custom_locations` shape. */
  radiusKm?: number;
  ageMin?: number;
  ageMax?: number;
  genders?: number[];                       // 1 = male, 2 = female; omit for all
  /** Free-text interest LABELS — Meta interest IDs need to be resolved
   *  against the live API per ad account. The launch flow logs a warning
   *  if the resolution returns no match; operator can hand-pick interest
   *  ids from Meta's Audience Insights and patch the template. */
  interestLabels?: string[];
  /** Detailed-targeting behaviour labels (homeowners, decision-makers,
   *  etc.). Same resolution caveat as interestLabels. */
  behaviorLabels?: string[];
  /** Exclude under-18s explicitly (separate from ageMin for paper-trail
   *  reasons — Meta's "special ad category" rules occasionally pin this). */
  excludeMinors?: boolean;
};

export type AdCopy = {
  /** Primary text — the body of the ad shown above the image. */
  primaryText: string;
  /** Bold headline below the image. */
  headline: string;
  /** Optional description under the headline. */
  description?: string;
  /** Meta CTA enum — LEARN_MORE, GET_QUOTE, BOOK_TRAVEL, CONTACT_US, etc.
   *  GET_QUOTE is the natural lead-gen choice; LEARN_MORE is the safe
   *  generic. */
  ctaType?: string;
};

export type LeadFormQuestion = {
  /** Meta's well-known question type. */
  type:
    | 'EMAIL'
    | 'FULL_NAME'
    | 'PHONE'
    | 'ZIP_CODE'
    | 'CITY'
    | 'STATE'
    | 'CUSTOM';
  /** Required for CUSTOM type — the prompt the visitor sees. */
  label?: string;
  /** Required for CUSTOM type — Meta uses this for the field key in
   *  webhooks. Lowercase, underscored. */
  key?: string;
  /** For CUSTOM type — input shape ('SHORT_ANSWER', 'MULTIPLE_CHOICE',
   *  etc.). */
  inputType?: string;
};

export type CampaignTemplate = {
  slug: CampaignTemplateSlug;
  displayName: string;
  /** One-sentence description shown on the launch wizard. */
  description: string;
  /** Suggested daily budget in MAJOR units (€, $) for the operator.
   *  Defaults to €7/day = ~€200/month, matching the month-1 ad-credit
   *  envelope. Operator can override. */
  suggestedDailyBudgetMajor: number;
  campaignNameTemplate: string;        // 'Voltline · Emergency call-outs · Q2'
  adSetNameTemplate: string;
  adNameTemplate: string;
  leadFormNameTemplate: string;
  targeting: TargetingSpec;
  copy: AdCopy;
  leadFormQuestions: LeadFormQuestion[];
  /**
   * Real-Meta-interest-ids-required notes the operator should resolve
   * before first launch. Surfaced inline in the launch wizard.
   */
  preLaunchChecklist: string[];
};

// --- placeholder substitution ------------------------------------------------

/** Substitute `{placeholder}` segments in template copy against the
 *  client's facts. Unknown placeholders are left in-place (operator will
 *  see them in the launch preview + fix). */
export function substituteCopy(
  template: string,
  context: {
    businessName?: string;
    industry?: string;
    serviceArea?: string;
    funnelService?: string;
    funnelGuarantee?: string;
  },
): string {
  return template.replace(/\{(businessName|industry|serviceArea|funnelService|funnelGuarantee)\}/g, (_match, key) => {
    const value = (context as Record<string, string | undefined>)[key];
    return value && value.trim().length > 0 ? value : `{${key}}`;
  });
}

/** The flat context the launch flow composes from whatever it has — the
 *  client's stored business name + the funnel brief (when present) +
 *  operator-typed overrides. Caller passes whatever it can resolve. */
export type CampaignTemplateContext = {
  businessName?: string;
  industry?: string;
  serviceArea?: string;
  funnelService?: string;
  funnelGuarantee?: string;
};

/** Compose the full copy + name objects for a context + template. */
export function applyTemplate(
  template: CampaignTemplate,
  context: CampaignTemplateContext,
): {
  campaignName: string;
  adSetName: string;
  adName: string;
  leadFormName: string;
  copy: AdCopy;
} {
  return {
    campaignName: substituteCopy(template.campaignNameTemplate, context),
    adSetName: substituteCopy(template.adSetNameTemplate, context),
    adName: substituteCopy(template.adNameTemplate, context),
    leadFormName: substituteCopy(template.leadFormNameTemplate, context),
    copy: {
      primaryText: substituteCopy(template.copy.primaryText, context),
      headline: substituteCopy(template.copy.headline, context),
      description: template.copy.description
        ? substituteCopy(template.copy.description, context)
        : undefined,
      ctaType: template.copy.ctaType,
    },
  };
}
