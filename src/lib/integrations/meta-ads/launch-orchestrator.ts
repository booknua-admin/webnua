// =============================================================================
// Meta Ads — launch orchestrator.
//
// Phase 7.5 Session 1. The single server-side entry point for launching a
// new lead-form campaign on a customer's connected Meta ad account.
//
// Chain (every step through `callWithToken` — token refresh + 401 retry
// + integration_call_log observability are automatic):
//
//   1. Resolve the client's ad account + Page (client_meta_ad_accounts)
//   2. Resolve a Page access token (createLeadForm requires Page-level)
//   3. Upload the operator's image to Meta → image_hash
//   4. createCampaign (status=PAUSED — never auto-publish before the
//      operator confirms; launch route flips to ACTIVE after success)
//   5. createAdSet (with the targeting spec + daily budget)
//   6. createLeadForm (questions from the template; privacy URL from
//      the customer's published site)
//   7. createAdCreative (image_hash + copy + CTA + lead_form_id)
//   8. createAd (binds creative to ad set)
//   9. (Optionally) activateCampaign + activateAd if the operator chose
//      "launch live" rather than "save as draft"
//  10. Persist via existing upsertCampaignFromMeta (writes meta_campaigns
//      + public.campaigns in lockstep)
//  11. Insert meta_campaign_launches snapshot (template + targeting +
//      brief context — frozen for cross-tenant training)
//  12. Insert meta_ad_creatives active row (image + copy version — the
//      first of potentially many as Session 4's refresh ships)
//
// On a mid-chain failure the orchestrator returns a structured failure
// indicating which step broke. The Meta-side artifacts created so far
// stay (Meta has no rollback — a partially-created campaign sits paused
// on the ad account, visible to the operator in Ads Manager); the
// orchestrator does NOT write any Webnua-side rows on failure, so the
// UI can let the operator retry without DB-state cleanup.
//
// SERVER-ONLY.
// =============================================================================

import {
  activateAd,
  activateAdSet,
  activateCampaign,
  createAd,
  createAdCreative,
  createAdSet,
  createCampaign,
  createLeadForm,
  getCampaign,
  getPageAccessToken,
  isMetaConfigured,
  uploadImageToMeta,
} from './client';
import { upsertCampaignFromMeta } from './campaigns';
import { insertAdCreative, insertCampaignLaunch } from './campaign-launches';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

import type {
  ClientMetaAdAccountRow,
  MetaCampaignRow,
} from './types';
import {
  type CopySubstitutions,
  type MetaAdTemplate,
  templateForIndustry,
} from './templates';

// --- input shape -------------------------------------------------------------

/** A city resolved via Meta's `targetingsearch` autocomplete — carries
 *  the Meta `key` that `geo_locations.cities[]` accepts plus the human
 *  label for the snapshot. */
export type LaunchTargetingCity = {
  key: string;
  label: string;
  radiusKm: number;
};

/** An interest resolved via Meta's autocomplete — carries the numeric
 *  `id` Meta expects in `flexible_spec.interests[]` plus the name. */
export type LaunchTargetingInterest = {
  id: string;
  name: string;
};

export type LaunchCampaignInput = {
  clientId: string;
  /** Operator who initiated the launch — stamped on the launch +
   *  creative rows for audit. */
  launchedByUserId: string;
  /** Industry slug — picks the template from META_AD_TEMPLATES. */
  templateSlug: string;
  /** Display name of the campaign in Meta + Webnua. */
  campaignName: string;
  /** Closed-set objective flavour (Session 1.2). 'lead_form_meta' uses
   *  Meta's native instant lead form (default); 'lead_form_landing'
   *  routes the ad to the customer's website + uses Meta Pixel for
   *  optimisation against the Lead event. */
  campaignObjective: 'lead_form_meta' | 'lead_form_landing';
  /** Required when `campaignObjective === 'lead_form_landing'` — the
   *  operator-selected pixel id. Persisted on
   *  `client_meta_ad_accounts.meta_pixel_id` separately; this is the
   *  value used in the ad set's promoted_object so Meta optimises
   *  against the Lead conversion event. */
  pixelId: string | null;

  /** Targeting */
  targetingGeoCenter: { lat: number; lng: number } | null;
  targetingRadiusKm: number | null;
  /** Cities resolved via Meta autocomplete. When non-empty these drive
   *  `geo_locations.cities[]` (preferred over lat/lng — Meta optimises
   *  delivery better on named cities). */
  targetingCities: LaunchTargetingCity[];
  targetingAgeMin: number;
  targetingAgeMax: number;
  /** Free-form interest keyword tokens — kept on the snapshot for
   *  training even when interest IDs ARE resolved (the human-readable
   *  string is the training signal). */
  targetingInterestTokens: string[];
  /** Resolved interest IDs from Meta autocomplete — passed through to
   *  the ad set spec via `flexible_spec.interests[]`. Empty array =
   *  broad targeting only. */
  targetingInterests: LaunchTargetingInterest[];
  /** ISO country code (e.g. 'AU', 'IE'). Required — Meta won't accept
   *  a geo-target spec without at least one country. */
  targetingCountries: string[];

  /** Budget + schedule. endTimeIso = null means "run until manually
   *  stopped" — Meta receives no end time, so winning ads keep
   *  delivering instead of timing out. */
  dailyBudgetCents: number;
  startTimeIso: string;
  endTimeIso: string | null;

  /** Creative — the shared image (all variants reuse this one upload,
   *  V1.3; per-variant image upload is V1.4 with the template overlays). */
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  /** One ad per variant inside the same ad set — Meta's standard A/B
   *  testing shape. Meta auto-allocates spend by performance. Each
   *  variant's copy lands in its own ad creative. Order matters: the
   *  first variant becomes the "primary" stored on meta_campaigns. */
  variants: Array<{
    headline: string;
    primaryText: string;
    description: string | null;
    ctaType: string;
  }>;
  /** Destination URL Meta opens AFTER the lead-form submit (the
   *  operator's published site, or a Webnua thank-you page). */
  linkUrl: string;
  /** Required by Meta for lead-form ads — must be the customer's actual
   *  privacy policy URL. The route resolves this from the client's
   *  published site. */
  privacyPolicyUrl: string;

  /** Operator-flagged first launch. Drives created_via on
   *  meta_campaigns + is_first_launch on meta_campaign_launches. The
   *  label is operator-facing audit only — no marketing claim. */
  isFirstLaunch: boolean;
  /** Whether to leave the campaign PAUSED in Meta (draft mode) or
   *  flip to ACTIVE post-create. V1: operator picks at launch step. */
  goLive: boolean;
};

// --- output shape ------------------------------------------------------------

export type LaunchSuccess = {
  ok: true;
  campaignId: string;
  metaCampaignId: string;
  metaCampaignDbId: string;
  paused: boolean;
};

export type LaunchFailure = {
  ok: false;
  /** Which step in the chain failed — surfaces in the wizard so the
   *  operator knows where to retry. */
  step:
    | 'resolve_ad_account'
    | 'resolve_page_token'
    | 'upload_image'
    | 'create_campaign'
    | 'create_ad_set'
    | 'create_lead_form'
    | 'create_creative'
    | 'create_ad'
    | 'activate'
    | 'persist';
  message: string;
  detail?: string;
  /** Meta-side ids that DID land before the failure — surfaced so the
   *  operator can clean up in Ads Manager if needed. */
  partial?: {
    metaCampaignId?: string;
    metaAdSetId?: string;
    metaLeadFormId?: string;
    metaCreativeId?: string;
    metaAdId?: string;
  };
};

export type LaunchResult = LaunchSuccess | LaunchFailure;

// --- main --------------------------------------------------------------------

export async function launchMetaCampaign(input: LaunchCampaignInput): Promise<LaunchResult> {
  if (!isMetaConfigured()) {
    return {
      ok: false,
      step: 'resolve_ad_account',
      message: 'Meta Ads is not configured on this deployment.',
    };
  }

  // Landing-page objective requires a pixel id — Meta needs it on the
  // ad set's promoted_object so it can optimise against the Lead
  // conversion event. The wizard blocks Launch until a pixel is
  // resolved; this is defence in depth at the orchestrator layer.
  if (input.campaignObjective === 'lead_form_landing' && !input.pixelId) {
    return {
      ok: false,
      step: 'resolve_ad_account',
      message:
        'Landing-page objective requires a Meta Pixel — pick one in step 1 of the wizard.',
    };
  }

  // 1. Resolve the client's connected ad account + Page.
  const adAccount = await fetchAdAccountForClient(input.clientId);
  if (!adAccount) {
    return {
      ok: false,
      step: 'resolve_ad_account',
      message:
        'No Meta ad account is wired to this client. Connect Meta on /settings/integrations first.',
    };
  }
  if (!adAccount.meta_page_id) {
    return {
      ok: false,
      step: 'resolve_ad_account',
      message:
        'No Facebook Page is wired to this client. Re-run the Meta connect flow and pick a Page.',
    };
  }
  const adAccountId = adAccount.meta_ad_account_id;
  const pageId = adAccount.meta_page_id;

  // 2. Page access token (lead-form CRUD requires it).
  const pageTokenResult = await getPageAccessToken(input.clientId, pageId);
  if (!pageTokenResult.ok) {
    return {
      ok: false,
      step: 'resolve_page_token',
      message: 'Could not resolve a Page access token.',
      detail: pageTokenResult.error.message,
    };
  }
  const pageAccessToken = pageTokenResult.data;

  // 3. Upload image → image_hash.
  const imageResult = await uploadImageToMeta(input.clientId, adAccountId, input.imageUrl);
  if (!imageResult.ok) {
    return {
      ok: false,
      step: 'upload_image',
      message: 'Meta rejected the image upload.',
      detail: imageResult.error.message,
    };
  }
  const imageHash = imageResult.data.imageHash;

  // 4. Create campaign (PAUSED initially — see goLive flag).
  const campaignResult = await createCampaign(input.clientId, {
    adAccountId,
    name: input.campaignName,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    specialAdCategories: [],
  });
  if (!campaignResult.ok || !campaignResult.data.id) {
    return {
      ok: false,
      step: 'create_campaign',
      message: 'Meta rejected the campaign create.',
      detail: campaignResult.ok ? 'No campaign id returned.' : campaignResult.error.message,
    };
  }
  const metaCampaignId = campaignResult.data.id;

  // 5. Create ad set with targeting + budget + schedule.
  //   • endTime is omitted when the operator opted for "run until
  //     manually stopped" — Meta accepts no end time as "indefinite",
  //     which is what we want for ads that should keep delivering past
  //     an arbitrary duration.
  //   • For the landing-page objective the ad set's promoted_object
  //     carries the customer's Meta Pixel id + 'LEAD' custom event so
  //     Meta optimises bidding against the Lead conversion fired on
  //     form submit (PublicSiteRenderer / FormBlock embed the pixel).
  const targetingSpec = buildTargetingSpec(input);
  const adSetResult = await createAdSet(input.clientId, {
    adAccountId,
    campaignId: metaCampaignId,
    name: `${input.campaignName} · Ad set`,
    dailyBudgetCents: input.dailyBudgetCents,
    targeting: targetingSpec,
    optimizationGoal: 'LEAD_GENERATION',
    billingEvent: 'IMPRESSIONS',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    status: 'PAUSED',
    startTime: input.startTimeIso,
    endTime: input.endTimeIso ?? undefined,
    promotedObjectPageId: pageId,
    promotedObjectPixelId:
      input.campaignObjective === 'lead_form_landing' ? input.pixelId : null,
  });
  if (!adSetResult.ok || !adSetResult.data.id) {
    return {
      ok: false,
      step: 'create_ad_set',
      message: 'Meta rejected the ad-set create.',
      detail: adSetResult.ok ? 'No ad-set id returned.' : adSetResult.error.message,
      partial: { metaCampaignId },
    };
  }
  const metaAdSetId = adSetResult.data.id;

  // 6. Create lead form on the Page — ONLY for the in-Meta objective.
  //    The landing-page objective routes the click to the customer's
  //    website, so there's no on-Meta form to attach.
  const template = templateForIndustry(input.templateSlug);
  let metaLeadFormId: string | null = null;
  if (input.campaignObjective === 'lead_form_meta') {
    const leadFormResult = await createLeadForm(input.clientId, {
      pageId,
      pageAccessToken,
      name: `${input.campaignName} · Lead form`,
      questions: template.leadFormQuestions.map((q) => ({
        type: q.type,
        key: q.key,
        label: q.label,
      })),
      privacyPolicyUrl: input.privacyPolicyUrl,
    });
    if (!leadFormResult.ok || !leadFormResult.data.id) {
      return {
        ok: false,
        step: 'create_lead_form',
        message: 'Meta rejected the lead-form create.',
        detail: leadFormResult.ok
          ? 'No lead-form id returned.'
          : leadFormResult.error.message,
        partial: { metaCampaignId, metaAdSetId },
      };
    }
    metaLeadFormId = leadFormResult.data.id;
  }

  // 7 + 8. For each variant create one ad creative + one ad inside
  // the same ad set. Meta's standard A/B testing shape — N ads in one
  // ad set, Meta auto-allocates spend by performance. All variants
  // share the same image_hash + lead form (when objective is in-Meta).
  // The orchestrator bails on the first variant's failure with partial
  // state intact (Meta has no rollback; the operator can clean up in
  // Ads Manager via the surfaced ids).
  //
  // The first launched variant's ids become the "primary" stored on
  // meta_campaigns.meta_ad_id / meta_creative_id — those columns are
  // legacy / informational; `meta_ad_creatives` is the source of truth
  // for the full per-variant set.
  if (input.variants.length === 0) {
    return {
      ok: false,
      step: 'create_creative',
      message: 'At least one variant is required to launch.',
      partial: { metaCampaignId, metaAdSetId, metaLeadFormId: metaLeadFormId ?? undefined },
    };
  }
  const launchedAds: Array<{
    metaAdId: string;
    metaCreativeId: string;
    variant: LaunchCampaignInput['variants'][number];
  }> = [];
  for (let i = 0; i < input.variants.length; i += 1) {
    const variant = input.variants[i];
    const creativeResult = await createAdCreative(input.clientId, {
      adAccountId,
      name: `${input.campaignName} · Variant ${i + 1} · Creative`,
      pageId,
      leadFormId: metaLeadFormId,
      headline: variant.headline,
      primaryText: variant.primaryText,
      description: variant.description ?? undefined,
      imageHash,
      linkUrl: input.linkUrl,
      ctaType: variant.ctaType,
    });
    if (!creativeResult.ok || !creativeResult.data.id) {
      return {
        ok: false,
        step: 'create_creative',
        message: `Meta rejected the ad-creative create for variant ${i + 1}.`,
        detail: creativeResult.ok
          ? 'No creative id returned.'
          : creativeResult.error.message,
        partial: {
          metaCampaignId,
          metaAdSetId,
          metaLeadFormId: metaLeadFormId ?? undefined,
        },
      };
    }
    const variantCreativeId = creativeResult.data.id;
    const adResult = await createAd(input.clientId, {
      adAccountId,
      adSetId: metaAdSetId,
      creativeId: variantCreativeId,
      name: `${input.campaignName} · Variant ${i + 1}`,
      status: 'PAUSED',
    });
    if (!adResult.ok || !adResult.data.id) {
      return {
        ok: false,
        step: 'create_ad',
        message: `Meta rejected the ad create for variant ${i + 1}.`,
        detail: adResult.ok ? 'No ad id returned.' : adResult.error.message,
        partial: {
          metaCampaignId,
          metaAdSetId,
          metaLeadFormId: metaLeadFormId ?? undefined,
          metaCreativeId: variantCreativeId,
        },
      };
    }
    launchedAds.push({
      metaAdId: adResult.data.id,
      metaCreativeId: variantCreativeId,
      variant,
    });
  }
  // Primary ad/creative — the first launched variant. Stored on
  // meta_campaigns; `meta_ad_creatives` is the per-variant SoT.
  const metaCreativeId = launchedAds[0].metaCreativeId;
  const metaAdId = launchedAds[0].metaAdId;

  // 9. Optionally activate if operator chose "go live now".
  // Activation failures DO NOT fail the whole launch — the campaign is
  // built; the operator can flip it ACTIVE from Webnua's /campaigns
  // pause/activate path without leaving the app. Activation order:
  // campaign first, then ad set, then every ad (Meta requires the
  // campaign be ACTIVE before an ad set under it can activate; ad sets
  // must be ACTIVE before ads).
  if (input.goLive) {
    const campaignActivation = await activateCampaign(input.clientId, metaCampaignId);
    if (!campaignActivation.ok) {
      console.warn(
        '[meta-ads/launch] campaign activation failed (non-fatal):',
        campaignActivation.error.message,
      );
    }
    const adSetActivation = await activateAdSet(input.clientId, metaAdSetId);
    if (!adSetActivation.ok) {
      console.warn(
        '[meta-ads/launch] ad set activation failed (non-fatal):',
        adSetActivation.error.message,
      );
    }
    const adActivations = await Promise.all(
      launchedAds.map((a) => activateAd(input.clientId, a.metaAdId)),
    );
    for (let i = 0; i < adActivations.length; i += 1) {
      const r = adActivations[i];
      if (!r.ok) {
        console.warn(
          `[meta-ads/launch] ad ${i + 1} activation failed (non-fatal):`,
          r.error.message,
        );
      }
    }
  }

  // 10. Persist via the shared upsert path (writes meta_campaigns +
  //     public.campaigns in lockstep). We need to re-fetch the campaign
  //     from Meta first so the upsert reads its canonical status.
  const refreshed = await getCampaign(input.clientId, metaCampaignId);
  if (!refreshed.ok) {
    return {
      ok: false,
      step: 'persist',
      message:
        'Campaign built on Meta but Webnua could not fetch its canonical state.',
      detail: refreshed.error.message,
      partial: {
        metaCampaignId,
        metaAdSetId,
        metaLeadFormId: metaLeadFormId ?? undefined,
        metaCreativeId,
        metaAdId,
      },
    };
  }
  let upserted: { row: MetaCampaignRow; inserted: boolean };
  try {
    upserted = await upsertCampaignFromMeta({
      clientId: input.clientId,
      metaCampaign: refreshed.data,
      createdVia: input.isFirstLaunch ? 'webnua_month_1' : 'webnua_ongoing',
    });
  } catch (error) {
    return {
      ok: false,
      step: 'persist',
      message: 'Webnua could not persist the campaign metadata.',
      detail: (error as Error).message,
      partial: {
        metaCampaignId,
        metaAdSetId,
        metaLeadFormId: metaLeadFormId ?? undefined,
        metaCreativeId,
        metaAdId,
      },
    };
  }
  // Patch the meta_campaigns row with the per-launch Meta ids that
  // upsertCampaignFromMeta leaves null (V1's ingest path doesn't walk
  // these — we know them directly from the launch chain).
  await getIntegrationDb()
    .from('meta_campaigns')
    .update({
      meta_ad_set_id: metaAdSetId,
      meta_ad_id: metaAdId,
      meta_creative_id: metaCreativeId,
      meta_lead_form_id: metaLeadFormId,
      template_slug: input.templateSlug,
    } as unknown as never)
    .eq('id', upserted.row.id);

  // 11. Insert launch snapshot.
  const briefSnapshot = await buildBriefSnapshot(input.clientId);
  try {
    await insertCampaignLaunch({
      meta_campaign_id: upserted.row.id,
      client_id: input.clientId,
      template_slug: input.templateSlug,
      template_variant: null,
      campaign_objective: input.campaignObjective,
      targeting_geo_center: input.targetingGeoCenter,
      targeting_radius_km: input.targetingRadiusKm,
      targeting_age_min: input.targetingAgeMin,
      targeting_age_max: input.targetingAgeMax,
      targeting_interest_tokens: input.targetingInterestTokens,
      targeting_countries: input.targetingCountries,
      targeting_full_spec: targetingSpec as Record<string, unknown>,
      brief_snapshot: briefSnapshot,
      launched_by_user_id: input.launchedByUserId,
      launched_at: new Date().toISOString(),
      is_first_launch: input.isFirstLaunch,
    });
  } catch (error) {
    // Non-fatal — campaign is live, snapshot insert is observability.
    // Log + continue so the operator sees success.
    console.warn(
      '[meta-ads/launch] meta_campaign_launches insert failed (non-fatal):',
      (error as Error).message,
    );
  }

  // 12. Insert one meta_ad_creatives row per launched variant.
  //     Session 1.3 — the partial unique index "one active row per
  //     campaign" was dropped in migration 0117 because multi-variant
  //     launches have N active creatives concurrently. Per-creative
  //     outcomes derive from joining meta_ads_insights on date_recorded
  //     BETWEEN started_at AND ended_at — see migration 0115 + 0117
  //     comments.
  const launchedAt = new Date().toISOString();
  for (const a of launchedAds) {
    try {
      await insertAdCreative({
        meta_campaign_id: upserted.row.id,
        client_id: input.clientId,
        started_at: launchedAt,
        ended_at: null,
        meta_ad_id: a.metaAdId,
        meta_creative_id: a.metaCreativeId,
        meta_image_hash: imageHash,
        image_url: input.imageUrl,
        image_width: input.imageWidth,
        image_height: input.imageHeight,
        headline: a.variant.headline,
        primary_text: a.variant.primaryText,
        description: a.variant.description,
        cta_type: a.variant.ctaType,
        created_by_user_id: input.launchedByUserId,
      });
    } catch (error) {
      console.warn(
        '[meta-ads/launch] meta_ad_creatives insert failed (non-fatal):',
        (error as Error).message,
      );
    }
  }

  return {
    ok: true,
    campaignId: upserted.row.campaign_id,
    metaCampaignId,
    metaCampaignDbId: upserted.row.id,
    paused: !input.goLive,
  };
}

// --- helpers -----------------------------------------------------------------

async function fetchAdAccountForClient(
  clientId: string,
): Promise<ClientMetaAdAccountRow | null> {
  const db = getIntegrationDb();
  const { data, error } = await db
    .from('client_meta_ad_accounts')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(`fetchAdAccountForClient failed: ${error.message}`);
  return (data as ClientMetaAdAccountRow | null) ?? null;
}

/** Snapshot the brand row + key clients fields at launch. No PII —
 *  training set correlates context features with outcomes, not customer
 *  identity. */
async function buildBriefSnapshot(clientId: string): Promise<{
  brand: {
    industry_category: string;
    services: string[];
    top_jobs_to_be_booked: string[];
    voice_formality: number;
    voice_urgency: number;
    voice_technicality: number;
    audience_line: string;
    accent_color: string;
    offer: unknown;
    tagline: string | null;
  } | null;
  client: { industry: string; service_area: string | null; name: string };
}> {
  const db = getIntegrationDb();
  const [brandRes, clientRes] = await Promise.all([
    db
      .from('brands')
      .select(
        'industry_category, services, top_jobs_to_be_booked, voice_formality, voice_urgency, voice_technicality, audience_line, accent_color, offer, tagline',
      )
      .eq('client_id', clientId)
      .maybeSingle(),
    db
      .from('clients')
      .select('industry, service_area, name')
      .eq('id', clientId)
      .single(),
  ]);
  const brandRow = brandRes.data as
    | {
        industry_category?: string | null;
        services?: string[] | null;
        top_jobs_to_be_booked?: string[] | null;
        voice_formality?: number | null;
        voice_urgency?: number | null;
        voice_technicality?: number | null;
        audience_line?: string | null;
        accent_color?: string | null;
        offer?: unknown;
        tagline?: string | null;
      }
    | null
    | undefined;
  const clientRow = clientRes.data as
    | { industry?: string; service_area?: string | null; name?: string }
    | null;
  return {
    brand: brandRow
      ? {
          industry_category: brandRow.industry_category ?? '',
          services: brandRow.services ?? [],
          top_jobs_to_be_booked: brandRow.top_jobs_to_be_booked ?? [],
          voice_formality: brandRow.voice_formality ?? 3,
          voice_urgency: brandRow.voice_urgency ?? 3,
          voice_technicality: brandRow.voice_technicality ?? 3,
          audience_line: brandRow.audience_line ?? '',
          accent_color: brandRow.accent_color ?? '',
          offer: brandRow.offer ?? null,
          tagline: brandRow.tagline ?? null,
        }
      : null,
    client: {
      industry: clientRow?.industry ?? '',
      service_area: clientRow?.service_area ?? null,
      name: clientRow?.name ?? '',
    },
  };
}

/** Build Meta's targeting spec from the wizard input.
 *
 *  Geo (in order of preference, Meta merges them):
 *    1. Resolved cities via autocomplete → `geo_locations.cities[]`
 *    2. Lat/lng + radius (operator-typed) → `custom_locations[]`
 *    3. Country fallback → `geo_locations.countries[]`
 *
 *  Interests: when resolved via autocomplete, passed as
 *  `flexible_spec.interests[{ id, name }]` — the structure Meta uses
 *  for "must match at least one of these interests". Free-form keyword
 *  tokens are not passed to Meta (they're stored on the snapshot for
 *  training but Meta needs numeric ids).
 *
 *  Custom audiences / lookalikes are V1.2. */
function buildTargetingSpec(input: LaunchCampaignInput): Record<string, unknown> {
  const spec: Record<string, unknown> = {
    age_min: input.targetingAgeMin,
    age_max: input.targetingAgeMax,
    targeting_automation: { advantage_audience: 1 },
  };
  const geoLocations: Record<string, unknown> = {};
  if (input.targetingCountries.length > 0) {
    geoLocations.countries = input.targetingCountries;
  }
  if (input.targetingCities.length > 0) {
    geoLocations.cities = input.targetingCities.map((c) => ({
      key: c.key,
      radius: c.radiusKm,
      distance_unit: 'kilometer',
    }));
  } else if (input.targetingGeoCenter && input.targetingRadiusKm) {
    geoLocations.custom_locations = [
      {
        latitude: input.targetingGeoCenter.lat,
        longitude: input.targetingGeoCenter.lng,
        radius: input.targetingRadiusKm,
        distance_unit: 'kilometer',
      },
    ];
  }
  spec.geo_locations = geoLocations;
  if (input.targetingInterests.length > 0) {
    spec.flexible_spec = [
      {
        interests: input.targetingInterests.map((i) => ({ id: i.id, name: i.name })),
      },
    ];
  }
  return spec;
}

export type { MetaAdTemplate, CopySubstitutions };
