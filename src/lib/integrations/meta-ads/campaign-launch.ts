// =============================================================================
// Meta Ads — campaign-launch orchestrator.
//
// Phase 7 Meta Ads. The 5-step Meta API sequence + the local row inserts,
// run from one entry point so the operator launch route + future automated
// launch flows share one implementation.
//
// Sequence:
//   1. Insert a public.campaigns row (the operator-facing concept). This
//      is what the /campaigns hub already reads from. external_ref is
//      written once we have the Meta campaign id (step 5).
//   2. Resolve targeting → Meta's targeting spec shape.
//   3. createCampaign → Meta campaign id.
//   4. createAdSet → ad-set id.
//   5. createLeadForm (Page-scoped) → lead-form id; insert meta_lead_forms row.
//   6. createAdCreative → creative id.
//   7. createAd → ad id.
//   8. Insert public.meta_campaigns row linking everything; update
//      public.campaigns.external_ref to the Meta campaign id.
//
// If any step fails partway, we DO NOT auto-rollback the prior Meta calls
// (a half-created Meta campaign with a created-but-unused lead form is a
// real risk an operator can clean up; an aborted local-only flow would
// hide that). The function returns a structured error indicating which
// step failed; the route surfaces it.
//
// SERVER-ONLY.
// =============================================================================

import {
  createAd,
  createAdCreative,
  createAdSet,
  createCampaign,
  createLeadForm,
} from './client';
import { insertMetaCampaign } from './campaigns';
import { insertLeadForm } from './lead-forms';
import { findAdAccountByClientId } from './ad-accounts';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import {
  applyTemplate,
  type CampaignTemplate,
  type CampaignTemplateContext,
  type TargetingSpec,
} from './campaign-templates/types';

// --- input + result shapes ---------------------------------------------------

export type LaunchCampaignInput = {
  clientId: string;
  template: CampaignTemplate;
  context: CampaignTemplateContext;
  /** Operator-confirmed values (override the template defaults). */
  dailyBudgetMajor: number;
  startDate?: string;
  endDate?: string;
  /** The Facebook Page id to attach the ad to + the page-scoped access
   *  token (both come from listPages — the picker UI hands back both). */
  pageId: string;
  pageAccessToken: string;
  /** Privacy-policy URL from the client's site. Meta REQUIRES this on
   *  every lead form. */
  privacyPolicyUrl: string;
  /** Optional pre-uploaded image hash from Meta's Image Library. When
   *  omitted, Meta accepts the creative without an image but the ad
   *  performs poorly — operator will see a warning. */
  imageHash?: string;
  linkUrl: string;                       // landing page / website URL
  /** Whether to launch ACTIVE or PAUSED. Default PAUSED — operator
   *  confirms in Meta Ads Manager before publishing. */
  initialStatus?: 'ACTIVE' | 'PAUSED';
  /** Special-ad-categories — Meta requires this empty array even when not
   *  applicable. CREDIT/EMPLOYMENT/HOUSING/ISSUES_ELECTIONS_POLITICS are
   *  the categories that trigger heightened review. */
  specialAdCategories?: string[];
  /** Stripe-correlated month-1 tag. The route computes whether the
   *  client's first campaign falls within the month-1 window. */
  createdVia: 'webnua_month_1' | 'webnua_ongoing' | 'external';
  /** Targeting overrides. When omitted, we use the template's targeting
   *  spec verbatim. */
  targetingOverrides?: Partial<TargetingSpec>;
  /** Latitude/longitude for radius targeting; falls back to country-level
   *  targeting when omitted (broader, lower CPL early on). */
  centroidLat?: number;
  centroidLng?: number;
};

export type LaunchCampaignResult =
  | {
      ok: true;
      metaCampaignDbId: string;
      campaignDbId: string;
      metaCampaignId: string;
      metaAdSetId: string;
      metaAdId: string;
      metaCreativeId: string;
      metaLeadFormId: string;
    }
  | {
      ok: false;
      step:
        | 'pre-flight'
        | 'create-campaign-row'
        | 'create-campaign'
        | 'create-ad-set'
        | 'create-lead-form'
        | 'create-creative'
        | 'create-ad'
        | 'finalize';
      message: string;
      /** Anything Meta-side we DID create — surface so operator can clean
       *  up in Meta Ads Manager. */
      partial?: Partial<{
        metaCampaignId: string;
        metaAdSetId: string;
        metaLeadFormId: string;
        metaCreativeId: string;
        metaAdId: string;
        campaignDbId: string;
      }>;
    };

// --- helpers -----------------------------------------------------------------

function targetingToMeta(
  template: CampaignTemplate,
  overrides: Partial<TargetingSpec> = {},
  centroidLat?: number,
  centroidLng?: number,
): Record<string, unknown> {
  const t: TargetingSpec = { ...template.targeting, ...overrides };
  const spec: Record<string, unknown> = {};
  if (t.countries && t.countries.length > 0) {
    spec.geo_locations = { countries: t.countries };
  }
  // Radius targeting takes precedence over country-only when a centroid is
  // available. Meta's `custom_locations` accepts (lat, lng, radius, unit).
  if (centroidLat != null && centroidLng != null && t.radiusKm != null) {
    spec.geo_locations = {
      ...(spec.geo_locations as Record<string, unknown> | undefined),
      custom_locations: [
        {
          latitude: centroidLat,
          longitude: centroidLng,
          radius: t.radiusKm,
          distance_unit: 'kilometer',
        },
      ],
    };
  }
  if (t.ageMin != null) spec.age_min = t.ageMin;
  if (t.ageMax != null) spec.age_max = t.ageMax;
  if (t.genders && t.genders.length > 0) spec.genders = t.genders;
  // Interest LABELS — Meta wants ids. The template uses labels as a
  // resolution prompt for the operator (preLaunchChecklist surfaces this).
  // We DON'T silently pass labels as ids — that would fail at Meta's
  // validation and produce a confusing error. Skip entirely when no real
  // ids have been resolved; the operator can edit the ad set in Meta Ads
  // Manager to add interest targeting post-launch.
  // TODO(meta): wire the Targeting Browse API + cache results so we can
  // auto-resolve common labels. For V1, no interests = country/radius +
  // age targeting only, which Meta accepts.
  return spec;
}

function majorToCents(major: number): number {
  return Math.round(major * 100);
}

// --- entry -------------------------------------------------------------------

export async function launchCampaign(
  input: LaunchCampaignInput,
): Promise<LaunchCampaignResult> {
  // --- 0. Pre-flight: the client must have an ad-account assignment.
  const adAccount = await findAdAccountByClientId(input.clientId);
  if (!adAccount) {
    return {
      ok: false,
      step: 'pre-flight',
      message: 'Client has no Meta ad account assigned. Connect Meta and pick an ad account first.',
    };
  }

  const composed = applyTemplate(input.template, input.context);
  const dailyBudgetCents = majorToCents(input.dailyBudgetMajor);

  // --- 1. Create the operator-facing campaign concept first. This is
  // what the existing /campaigns surface reads from; we want it to
  // exist even if Meta-side calls fail (so the operator sees the failure
  // attempt + can retry). external_ref filled in step 8.
  const db = getIntegrationDb();
  const { data: campaignRow, error: campaignErr } = await db
    .from('campaigns')
    .insert({
      client_id: input.clientId,
      name: composed.campaignName,
      status: 'pending',                   // becomes 'active' on first insights sync
      budget: input.dailyBudgetMajor,
      starts_at: input.startDate ? new Date(input.startDate).toISOString() : null,
      ends_at: input.endDate ? new Date(input.endDate).toISOString() : null,
    } as unknown as never)
    .select('id')
    .single();
  if (campaignErr || !campaignRow) {
    return {
      ok: false,
      step: 'create-campaign-row',
      message: `Failed to create operator campaign record: ${campaignErr?.message ?? 'no row'}`,
    };
  }
  const campaignDbId = (campaignRow as { id: string }).id;

  // --- 2. Meta campaign.
  const metaCampaign = await createCampaign(input.clientId, {
    adAccountId: adAccount.meta_ad_account_id,
    name: composed.campaignName,
    status: input.initialStatus ?? 'PAUSED',
    specialAdCategories: input.specialAdCategories ?? [],
    // V1: lead-gen objective. Meta has two flavours:
    //   • OUTCOME_LEADS (ODAX, newer, mostly auto-required for new accounts)
    //   • LEAD_GENERATION (legacy, still accepted on older accounts)
    // We default to OUTCOME_LEADS; if Meta rejects we'd see it in
    // integration_call_log and switch.
    objective: 'OUTCOME_LEADS',
  });
  if (!metaCampaign.ok || !metaCampaign.data.id) {
    return {
      ok: false,
      step: 'create-campaign',
      message: metaCampaign.ok
        ? 'createCampaign returned no campaign id'
        : `${metaCampaign.error.class}: ${metaCampaign.error.message}`,
      partial: { campaignDbId },
    };
  }
  const metaCampaignId = metaCampaign.data.id;

  // --- 3. Lead form (must exist before the creative references it).
  const leadFormCreate = await createLeadForm(input.clientId, {
    pageId: input.pageId,
    pageAccessToken: input.pageAccessToken,
    name: composed.leadFormName,
    questions: input.template.leadFormQuestions,
    privacyPolicyUrl: input.privacyPolicyUrl,
  });
  if (!leadFormCreate.ok || !leadFormCreate.data.id) {
    return {
      ok: false,
      step: 'create-lead-form',
      message: leadFormCreate.ok
        ? 'createLeadForm returned no form id'
        : `${leadFormCreate.error.class}: ${leadFormCreate.error.message}`,
      partial: { campaignDbId, metaCampaignId },
    };
  }
  const metaFormId = leadFormCreate.data.id;
  const leadFormRow = await insertLeadForm({
    client_id: input.clientId,
    meta_form_id: metaFormId,
    meta_page_id: input.pageId,
    form_name: composed.leadFormName,
    fields: input.template.leadFormQuestions,
    archived_at: null,
  });

  // --- 4. Ad set with targeting.
  const targeting = targetingToMeta(
    input.template,
    input.targetingOverrides,
    input.centroidLat,
    input.centroidLng,
  );
  const adSet = await createAdSet(input.clientId, {
    adAccountId: adAccount.meta_ad_account_id,
    campaignId: metaCampaignId,
    name: composed.adSetName,
    dailyBudgetCents,
    targeting,
    optimizationGoal: 'LEAD_GENERATION',
    status: input.initialStatus ?? 'PAUSED',
    startTime: input.startDate ? new Date(input.startDate).toISOString() : undefined,
    endTime: input.endDate ? new Date(input.endDate).toISOString() : undefined,
    promotedObjectPageId: input.pageId,
  });
  if (!adSet.ok || !adSet.data.id) {
    return {
      ok: false,
      step: 'create-ad-set',
      message: adSet.ok
        ? 'createAdSet returned no ad-set id'
        : `${adSet.error.class}: ${adSet.error.message}`,
      partial: { campaignDbId, metaCampaignId, metaLeadFormId: metaFormId },
    };
  }
  const metaAdSetId = adSet.data.id;

  // --- 5. Ad creative.
  const creative = await createAdCreative(input.clientId, {
    adAccountId: adAccount.meta_ad_account_id,
    name: `${composed.adName} · creative`,
    pageId: input.pageId,
    leadFormId: metaFormId,
    headline: composed.copy.headline,
    primaryText: composed.copy.primaryText,
    description: composed.copy.description,
    imageHash: input.imageHash,
    linkUrl: input.linkUrl,
    ctaType: composed.copy.ctaType ?? 'GET_QUOTE',
  });
  if (!creative.ok || !creative.data.id) {
    return {
      ok: false,
      step: 'create-creative',
      message: creative.ok
        ? 'createAdCreative returned no creative id'
        : `${creative.error.class}: ${creative.error.message}`,
      partial: {
        campaignDbId,
        metaCampaignId,
        metaLeadFormId: metaFormId,
      },
    };
  }
  const metaCreativeId = creative.data.id;

  // --- 6. Ad (binds the ad set + creative).
  const ad = await createAd(input.clientId, {
    adAccountId: adAccount.meta_ad_account_id,
    adSetId: metaAdSetId,
    creativeId: metaCreativeId,
    name: composed.adName,
    status: input.initialStatus ?? 'PAUSED',
  });
  if (!ad.ok || !ad.data.id) {
    return {
      ok: false,
      step: 'create-ad',
      message: ad.ok
        ? 'createAd returned no ad id'
        : `${ad.error.class}: ${ad.error.message}`,
      partial: {
        campaignDbId,
        metaCampaignId,
        metaLeadFormId: metaFormId,
        metaCreativeId,
      },
    };
  }
  const metaAdId = ad.data.id;

  // --- 7. Insert meta_campaigns linking everything.
  let metaCampaignDbRow;
  try {
    metaCampaignDbRow = await insertMetaCampaign({
      client_id: input.clientId,
      campaign_id: campaignDbId,
      meta_campaign_id: metaCampaignId,
      meta_ad_set_id: metaAdSetId,
      meta_ad_id: metaAdId,
      meta_creative_id: metaCreativeId,
      meta_lead_form_id: leadFormRow.id,
      campaign_name: composed.campaignName,
      objective: 'OUTCOME_LEADS',
      status: input.initialStatus === 'ACTIVE' ? 'active' : 'in_review',
      daily_budget_cents: dailyBudgetCents,
      lifetime_budget_cents: null,
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      created_via: input.createdVia,
      template_slug: input.template.slug,
      last_synced_at: new Date().toISOString(),
      last_insights_synced_at: null,
    });
  } catch (err) {
    return {
      ok: false,
      step: 'finalize',
      message: err instanceof Error ? err.message : 'finalize failed',
      partial: {
        campaignDbId,
        metaCampaignId,
        metaAdSetId,
        metaLeadFormId: metaFormId,
        metaCreativeId,
        metaAdId,
      },
    };
  }

  // --- 8. Patch the external_ref on the operator-facing record so the
  // existing /campaigns surface can join through.
  const { error: refErr } = await db
    .from('campaigns')
    .update({ external_ref: metaCampaignId } as unknown as never)
    .eq('id', campaignDbId);
  if (refErr) {
    // Best-effort — the meta_campaigns row already carries the linkage;
    // the external_ref is a denormalised convenience for surfaces that
    // read public.campaigns directly. Log and continue.
    console.warn(
      `[meta-ads] external_ref patch failed for campaign ${campaignDbId}: ${refErr.message}`,
    );
  }

  return {
    ok: true,
    metaCampaignDbId: metaCampaignDbRow.id,
    campaignDbId,
    metaCampaignId,
    metaAdSetId,
    metaAdId,
    metaCreativeId,
    metaLeadFormId: leadFormRow.id,
  };
}
