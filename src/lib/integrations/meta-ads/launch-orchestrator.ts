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

  /** Session 1.4 matrix: N image variants. Each becomes its own ad
   *  inside every ad set. Capped at 5 (Meta's learning algorithm
   *  dilutes past that). */
  images: Array<{
    imageUrl: string;
    imageWidth: number | null;
    imageHeight: number | null;
  }>;
  /** Session 1.4 matrix: M copy variants. Each becomes its own ad set
   *  (with CBO at the campaign level, Meta distributes spend across
   *  them). Capped at 5. */
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

  /** V1.4c — ad format. 'single_image' (default) keeps the M × N
   *  matrix from Session 1.4a: M ad sets × N ads each, one image per
   *  ad. 'carousel' collapses the per-image axis into ONE multi-card
   *  carousel ad per ad set — operator gets M ads total, each a
   *  swipeable carousel with 2-10 cards. Meta surfaces the
   *  winning-card-first on subsequent impressions via
   *  multi_share_optimized. */
  adFormat: 'single_image' | 'carousel';

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
   *  operator can clean up in Ads Manager if needed. Arrays for the
   *  matrix-shape (each ad set + every ad created so far). */
  partial?: {
    metaCampaignId?: string;
    metaAdSetIds?: string[];
    metaLeadFormId?: string;
    metaCreativeIds?: string[];
    metaAdIds?: string[];
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

  // Defence-in-depth validation — the wizard's step-4 gate also
  // checks these, but a direct route caller might skip them.
  if (input.variants.length === 0) {
    return {
      ok: false,
      step: 'create_creative',
      message: 'At least one copy variant is required to launch.',
    };
  }
  if (input.images.length === 0) {
    return {
      ok: false,
      step: 'upload_image',
      message: 'At least one image is required to launch.',
    };
  }

  // 3. Upload every image → array of image_hashes. Meta dedupes hashes
  //    per ad account so re-uploading the same URL is idempotent.
  const imageHashes: string[] = [];
  for (let i = 0; i < input.images.length; i += 1) {
    const img = input.images[i];
    const r = await uploadImageToMeta(input.clientId, adAccountId, img.imageUrl);
    if (!r.ok) {
      return {
        ok: false,
        step: 'upload_image',
        message: `Meta rejected image ${i + 1} of ${input.images.length}.`,
        detail: r.error.message,
      };
    }
    imageHashes.push(r.data.imageHash);
  }

  // 4. Create campaign (PAUSED initially — see goLive flag). CBO is
  //    on at the campaign level — Meta distributes spend across the M
  //    ad sets created in step 6, finding the winning copy variant
  //    automatically. Without CBO, each ad set would need its own
  //    daily_budget; matrix testing makes that a foot-gun.
  const campaignResult = await createCampaign(input.clientId, {
    adAccountId,
    name: input.campaignName,
    objective: 'OUTCOME_LEADS',
    status: 'PAUSED',
    specialAdCategories: [],
    dailyBudgetCents: input.dailyBudgetCents,
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

  // 5. Create lead form on the Page — ONLY for the in-Meta objective.
  //    ONE form shared across every ad set + every ad. The landing-page
  //    objective routes the click to the customer's website, so there's
  //    no on-Meta form to attach.
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
        partial: { metaCampaignId },
      };
    }
    metaLeadFormId = leadFormResult.data.id;
  }

  // 6 + 7. For each copy variant, create one ad set; inside each ad
  // set, create one creative + one ad per image. The matrix is
  // M variants × N images = M ad sets × N ads each.
  //
  // Ad sets carry NO daily_budget (CBO at the campaign level
  // distributes spend); targeting, schedule, and promoted_object are
  // identical across all ad sets — the only thing that changes between
  // ad sets is the COPY in their attached creatives. Inside each ad
  // set the IMAGE varies between ads. Meta finds the winning
  // (copy, image) cell.
  //
  // Order matters: launched[0] = (variant 0, image 0) — the
  // "representative" used for the legacy meta_campaigns.meta_ad_id /
  // meta_creative_id fields. The full matrix lives on
  // meta_ad_creatives.
  const targetingSpec = buildTargetingSpec(input);
  const launchedAdSets: string[] = [];
  const launchedAds: Array<{
    metaAdSetId: string;
    metaAdId: string;
    metaCreativeId: string;
    imageHash: string;
    imageInfo: LaunchCampaignInput['images'][number];
    variant: LaunchCampaignInput['variants'][number];
    copyVariantIndex: number;
    imageVariantIndex: number;
  }> = [];
  const allCreativeIds: string[] = [];
  const allAdIds: string[] = [];

  for (let v = 0; v < input.variants.length; v += 1) {
    const variant = input.variants[v];
    const adSetResult = await createAdSet(input.clientId, {
      adAccountId,
      campaignId: metaCampaignId,
      name: `${input.campaignName} · Copy ${v + 1}`,
      // No dailyBudgetCents — CBO at the campaign level.
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
        message: `Meta rejected the ad-set create for copy variant ${v + 1}.`,
        detail: adSetResult.ok
          ? 'No ad-set id returned.'
          : adSetResult.error.message,
        partial: {
          metaCampaignId,
          metaAdSetIds: launchedAdSets,
          metaLeadFormId: metaLeadFormId ?? undefined,
        },
      };
    }
    const adSetId = adSetResult.data.id;
    launchedAdSets.push(adSetId);

    if (input.adFormat === 'carousel') {
      // Carousel: ONE creative + ONE ad per ad set, with all N images
      // bundled as child_attachments. Cards share the variant's
      // post-body copy (primaryText) + headline + description;
      // operator can launch multiple copy variants to A/B-test
      // different card-headline sets.
      const creativeResult = await createAdCreative(input.clientId, {
        adAccountId,
        name: `${input.campaignName} · Copy ${v + 1} · Carousel · Creative`,
        pageId,
        leadFormId: metaLeadFormId,
        headline: variant.headline,
        primaryText: variant.primaryText,
        description: variant.description ?? undefined,
        linkUrl: input.linkUrl,
        ctaType: variant.ctaType,
        childAttachments: input.images.map((_, i) => ({
          imageHash: imageHashes[i],
        })),
      });
      if (!creativeResult.ok || !creativeResult.data.id) {
        return {
          ok: false,
          step: 'create_creative',
          message: `Meta rejected the carousel creative for copy ${v + 1}.`,
          detail: creativeResult.ok
            ? 'No creative id returned.'
            : creativeResult.error.message,
          partial: {
            metaCampaignId,
            metaAdSetIds: launchedAdSets,
            metaLeadFormId: metaLeadFormId ?? undefined,
            metaCreativeIds: allCreativeIds,
            metaAdIds: allAdIds,
          },
        };
      }
      const variantCreativeId = creativeResult.data.id;
      allCreativeIds.push(variantCreativeId);
      const adResult = await createAd(input.clientId, {
        adAccountId,
        adSetId,
        creativeId: variantCreativeId,
        name: `${input.campaignName} · Copy ${v + 1} · Carousel`,
        status: 'PAUSED',
      });
      if (!adResult.ok || !adResult.data.id) {
        return {
          ok: false,
          step: 'create_ad',
          message: `Meta rejected the carousel ad create for copy ${v + 1}.`,
          detail: adResult.ok ? 'No ad id returned.' : adResult.error.message,
          partial: {
            metaCampaignId,
            metaAdSetIds: launchedAdSets,
            metaLeadFormId: metaLeadFormId ?? undefined,
            metaCreativeIds: allCreativeIds,
            metaAdIds: allAdIds,
          },
        };
      }
      allAdIds.push(adResult.data.id);
      // Carousel: persist ONE meta_ad_creatives row per ad set, using
      // the first card as the "representative" image. The other cards
      // aren't decomposed in V1 — future sessions can add per-card
      // tracking with a card_index column if outcome attribution needs
      // per-card granularity.
      launchedAds.push({
        metaAdSetId: adSetId,
        metaAdId: adResult.data.id,
        metaCreativeId: variantCreativeId,
        imageHash: imageHashes[0],
        imageInfo: input.images[0],
        variant,
        copyVariantIndex: v,
        imageVariantIndex: 0,
      });
    } else {
      for (let i = 0; i < input.images.length; i += 1) {
        const imgInfo = input.images[i];
        const imageHash = imageHashes[i];
        const creativeResult = await createAdCreative(input.clientId, {
          adAccountId,
          name: `${input.campaignName} · Copy ${v + 1} · Image ${i + 1} · Creative`,
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
            message: `Meta rejected the creative for copy ${v + 1}, image ${i + 1}.`,
            detail: creativeResult.ok
              ? 'No creative id returned.'
              : creativeResult.error.message,
            partial: {
              metaCampaignId,
              metaAdSetIds: launchedAdSets,
              metaLeadFormId: metaLeadFormId ?? undefined,
              metaCreativeIds: allCreativeIds,
              metaAdIds: allAdIds,
            },
          };
        }
        const variantCreativeId = creativeResult.data.id;
        allCreativeIds.push(variantCreativeId);
        const adResult = await createAd(input.clientId, {
          adAccountId,
          adSetId,
          creativeId: variantCreativeId,
          name: `${input.campaignName} · Copy ${v + 1} · Image ${i + 1}`,
          status: 'PAUSED',
        });
        if (!adResult.ok || !adResult.data.id) {
          return {
            ok: false,
            step: 'create_ad',
            message: `Meta rejected the ad create for copy ${v + 1}, image ${i + 1}.`,
            detail: adResult.ok ? 'No ad id returned.' : adResult.error.message,
            partial: {
              metaCampaignId,
              metaAdSetIds: launchedAdSets,
              metaLeadFormId: metaLeadFormId ?? undefined,
              metaCreativeIds: allCreativeIds,
              metaAdIds: allAdIds,
            },
          };
        }
        allAdIds.push(adResult.data.id);
        launchedAds.push({
          metaAdSetId: adSetId,
          metaAdId: adResult.data.id,
          metaCreativeId: variantCreativeId,
          imageHash,
          imageInfo: imgInfo,
          variant,
          copyVariantIndex: v,
          imageVariantIndex: i,
        });
      }
    }
  }

  // Representative ids stored on meta_campaigns — the first launched
  // cell (variant 0, image 0). meta_ad_creatives is the matrix SoT.
  const metaAdSetId = launchedAds[0].metaAdSetId;
  const metaCreativeId = launchedAds[0].metaCreativeId;
  const metaAdId = launchedAds[0].metaAdId;

  // 8. Optionally activate. Activation order: campaign → every ad set
  // → every ad. Failures are non-fatal (operator can flip status from
  // /campaigns without re-running the chain).
  if (input.goLive) {
    const campaignActivation = await activateCampaign(input.clientId, metaCampaignId);
    if (!campaignActivation.ok) {
      console.warn(
        '[meta-ads/launch] campaign activation failed (non-fatal):',
        campaignActivation.error.message,
      );
    }
    const adSetActivations = await Promise.all(
      launchedAdSets.map((id) => activateAdSet(input.clientId, id)),
    );
    for (let i = 0; i < adSetActivations.length; i += 1) {
      const r = adSetActivations[i];
      if (!r.ok) {
        console.warn(
          `[meta-ads/launch] ad set ${i + 1} activation failed (non-fatal):`,
          r.error.message,
        );
      }
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
        metaAdSetIds: launchedAdSets,
        metaLeadFormId: metaLeadFormId ?? undefined,
        metaCreativeIds: allCreativeIds,
        metaAdIds: allAdIds,
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
        metaAdSetIds: launchedAdSets,
        metaLeadFormId: metaLeadFormId ?? undefined,
        metaCreativeIds: allCreativeIds,
        metaAdIds: allAdIds,
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

  // 12. Insert one meta_ad_creatives row per launched matrix cell.
  //     Session 1.4 — each row carries meta_ad_set_id + the matrix
  //     indices so per-cell outcome attribution is queryable. The
  //     partial unique index "one active row per campaign" was dropped
  //     in migration 0117; per-creative outcomes still derive from
  //     joining meta_ads_insights on date_recorded BETWEEN started_at
  //     AND ended_at. With per-ad-set insights (V1.5+), the join
  //     gains a meta_ad_set_id axis for finer granularity.
  const launchedAt = new Date().toISOString();
  for (const a of launchedAds) {
    try {
      await insertAdCreative({
        meta_campaign_id: upserted.row.id,
        client_id: input.clientId,
        started_at: launchedAt,
        ended_at: null,
        meta_ad_id: a.metaAdId,
        meta_ad_set_id: a.metaAdSetId,
        meta_creative_id: a.metaCreativeId,
        meta_image_hash: a.imageHash,
        image_url: a.imageInfo.imageUrl,
        image_width: a.imageInfo.imageWidth,
        image_height: a.imageInfo.imageHeight,
        headline: a.variant.headline,
        primary_text: a.variant.primaryText,
        description: a.variant.description,
        cta_type: a.variant.ctaType,
        copy_variant_index: a.copyVariantIndex,
        image_variant_index: a.imageVariantIndex,
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
