// =============================================================================
// Meta Ads — typed Marketing API wrapper.
//
// Phase 7 Meta Ads. Every per-tenant call routes through `callWithToken()`
// so the customer's long-lived access token is fresh, a 401 triggers exactly
// one refresh-and-retry, and every attempt is logged to integration_call_log
// via callExternal().
//
// V1 SCOPE: lead-generation campaigns. Eight call sites in total:
//   • listAdAccounts / getAdAccount / listPages — discovery (post-OAuth picker)
//   • createCampaign / createAdSet / createLeadForm / createAdCreative / createAd
//     — the launch orchestration sequence
//   • pauseCampaign / activateCampaign / pauseAd / activateAd — status flips
//   • getCampaignInsights — daily metrics pull
//   • getLeads — every-15-minutes lead pull
//
// What is NOT here: conversion ads, traffic ads, engagement ads, Reels ads,
// shopping ads, Instagram-specific endpoints (Meta auto-places across
// Facebook + Instagram for lead-gen). Add when V2 expands the offering.
//
// SERVER-ONLY — env + callExternal both server-only.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal, type IntegrationResult } from '@/lib/integrations/_shared/call';
import { callWithToken } from '@/lib/integrations/_shared/api-call-with-token';

import type {
  MetaAdAccount,
  MetaAdAccountsResponse,
  MetaAdCreateResponse,
  MetaAdSetCreateResponse,
  MetaCampaign,
  MetaCampaignCreateResponse,
  MetaCreativeCreateResponse,
  MetaInsightsResponse,
  MetaLeadFormCreateResponse,
  MetaLeadsResponse,
  MetaPage,
  MetaPagesResponse,
} from './types';

// --- endpoints ---------------------------------------------------------------

const META_API_VERSION = env.META_API_VERSION ?? 'v21.0';
const GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

// --- configuration check -----------------------------------------------------

/** True when the Meta OAuth app credentials are configured (and therefore
 *  the full Meta flow — connect, launch, sync — can run). */
export function isMetaConfigured(): boolean {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET);
}

// --- form-body helper --------------------------------------------------------
//
// Meta's API accepts both JSON bodies and form-encoded bodies on POST
// endpoints. We use form-encoded throughout because:
//   1. Meta's docs and quick-start examples use form encoding.
//   2. Some fields (lists of strings, simple objects) historically had
//      better support in form-encoded than JSON.
// `callExternal()` supports this via the `rawBody` escape hatch.

function form(params: Record<string, string | number | undefined | null>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    usp.set(k, String(v));
  }
  return usp.toString();
}

function jsonForm(params: Record<string, unknown>): string {
  // For complex nested values (targeting spec, lead-form questions), Meta
  // accepts JSON strings inside form-encoded keys. Encode each value as
  // JSON.
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' || typeof v === 'number') {
      usp.set(k, String(v));
    } else {
      usp.set(k, JSON.stringify(v));
    }
  }
  return usp.toString();
}

// --- ad-account discovery ----------------------------------------------------

/** List every ad account the connected user can manage. Used by the
 *  post-OAuth picker so the operator chooses WHICH ad account to wire to
 *  the Webnua client. Returns Meta's structured payload directly. */
export async function listAdAccounts(
  clientId: string,
): Promise<IntegrationResult<MetaAdAccount[]>> {
  return callWithToken<MetaAdAccount[]>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/me/adaccounts?${form({
        access_token: accessToken,
        fields:
          'id,account_id,name,currency,account_status,amount_spent,balance,timezone_name,business{id,name},funding_source',
        limit: 100,
      })}`;
      const result = await callExternal<MetaAdAccountsResponse>({
        provider: 'meta_ads',
        operation: 'list_ad_accounts',
        url,
        method: 'GET',
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.data ?? [], status: result.status };
    },
  );
}

/** Fetch detail (balance, spend, status, timezone) for a single ad account.
 *  Refresh on a cadence so dashboards show current balance. `adAccountId`
 *  in the 'act_NNNN' form. */
export async function getAdAccount(
  clientId: string,
  adAccountId: string,
): Promise<IntegrationResult<MetaAdAccount>> {
  return callWithToken<MetaAdAccount>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/${adAccountId}?${form({
        access_token: accessToken,
        fields:
          'id,account_id,name,currency,account_status,amount_spent,balance,timezone_name,business{id,name},funding_source',
      })}`;
      return callExternal<MetaAdAccount>({
        provider: 'meta_ads',
        operation: 'get_ad_account',
        url,
        method: 'GET',
        clientId,
      });
    },
  );
}

/** List every Facebook Page the user manages. Required for lead-gen ads —
 *  every ad attaches to a Page, and each Page issues its own page-scoped
 *  access token for the lead-form CRUD endpoints. */
export async function listPages(
  clientId: string,
): Promise<IntegrationResult<MetaPage[]>> {
  return callWithToken<MetaPage[]>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/me/accounts?${form({
        access_token: accessToken,
        fields: 'id,name,access_token,tasks',
        limit: 100,
      })}`;
      const result = await callExternal<MetaPagesResponse>({
        provider: 'meta_ads',
        operation: 'list_pages',
        url,
        method: 'GET',
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.data ?? [], status: result.status };
    },
  );
}

// --- campaign / ad-set / ad / creative creation ------------------------------

export type CreateCampaignParams = {
  adAccountId: string;
  name: string;
  /** V1: always 'OUTCOME_LEADS' (Outcome-Driven Ad Experiences) or the
   *  legacy 'LEAD_GENERATION' depending on the account. */
  objective?: string;
  /** ACTIVE or PAUSED. Default PAUSED so campaigns don't auto-publish
   *  before the operator confirms. */
  status?: 'ACTIVE' | 'PAUSED';
  /** Required for new ODAX campaigns. */
  specialAdCategories?: string[];
  dailyBudgetCents?: number;
  lifetimeBudgetCents?: number;
};

/** Create a campaign on the customer's ad account. Returns the campaign id
 *  on success. */
export async function createCampaign(
  clientId: string,
  params: CreateCampaignParams,
): Promise<IntegrationResult<MetaCampaignCreateResponse>> {
  return callWithToken<MetaCampaignCreateResponse>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const body: Record<string, unknown> = {
        access_token: accessToken,
        name: params.name,
        objective: params.objective ?? 'OUTCOME_LEADS',
        status: params.status ?? 'PAUSED',
        special_ad_categories: params.specialAdCategories ?? [],
      };
      if (params.dailyBudgetCents != null) body.daily_budget = params.dailyBudgetCents;
      if (params.lifetimeBudgetCents != null) body.lifetime_budget = params.lifetimeBudgetCents;
      return callExternal<MetaCampaignCreateResponse>({
        provider: 'meta_ads',
        operation: 'create_campaign',
        url: `${GRAPH}/${params.adAccountId}/campaigns`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: jsonForm(body),
        clientId,
      });
    },
  );
}

export type CreateAdSetParams = {
  adAccountId: string;
  campaignId: string;
  name: string;
  /** Daily budget in minor units. Omit when the parent campaign has
   *  CBO enabled — Meta rejects per-ad-set budgets in that case (the
   *  campaign's daily_budget is distributed across ad sets
   *  automatically). Session 1.4 matrix launches always use CBO so
   *  this stays undefined; pre-matrix launches still pass it. */
  dailyBudgetCents?: number;
  /** Targeting spec — country, geo radius, age, interests, demographics.
   *  Passed verbatim to Meta as JSON. The campaign-template files compose
   *  this shape. */
  targeting: Record<string, unknown>;
  /** Optimisation goal — for lead-gen this is usually 'LEAD_GENERATION'. */
  optimizationGoal?: string;
  /** Bid strategy — V1 uses LOWEST_COST_WITHOUT_CAP (Meta picks the bid). */
  bidStrategy?: string;
  billingEvent?: string;
  status?: 'ACTIVE' | 'PAUSED';
  startTime?: string;
  endTime?: string;
  promotedObjectPageId?: string;
  /** Phase 7.5 · Session 1.2 — for the landing-page objective, the
   *  customer's Meta Pixel id + 'LEAD' custom event get attached to
   *  promoted_object so Meta bids against the Lead conversion fired
   *  on the customer's website. NULL/undefined for the in-Meta lead
   *  form path (Meta optimises against the on-platform lead form
   *  natively when no pixel is set). */
  promotedObjectPixelId?: string | null;
};

export async function createAdSet(
  clientId: string,
  params: CreateAdSetParams,
): Promise<IntegrationResult<MetaAdSetCreateResponse>> {
  return callWithToken<MetaAdSetCreateResponse>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const body: Record<string, unknown> = {
        access_token: accessToken,
        name: params.name,
        campaign_id: params.campaignId,
        optimization_goal: params.optimizationGoal ?? 'LEAD_GENERATION',
        billing_event: params.billingEvent ?? 'IMPRESSIONS',
        bid_strategy: params.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
        status: params.status ?? 'PAUSED',
        targeting: params.targeting,
      };
      if (params.dailyBudgetCents != null) {
        body.daily_budget = params.dailyBudgetCents;
      }
      if (params.startTime) body.start_time = params.startTime;
      if (params.endTime) body.end_time = params.endTime;
      // promoted_object shape depends on the optimisation target:
      //   • Pixel-tracked (landing page) → { pixel_id, custom_event_type }
      //     + the Page id (Meta needs both: pixel for conversion target,
      //     page for ad attribution).
      //   • Lead form on Meta (default) → just the Page id; Meta routes
      //     optimisation against the on-platform lead form.
      if (params.promotedObjectPixelId) {
        const promoted: Record<string, unknown> = {
          pixel_id: params.promotedObjectPixelId,
          custom_event_type: 'LEAD',
        };
        if (params.promotedObjectPageId) {
          promoted.page_id = params.promotedObjectPageId;
        }
        body.promoted_object = promoted;
      } else if (params.promotedObjectPageId) {
        body.promoted_object = { page_id: params.promotedObjectPageId };
      }
      return callExternal<MetaAdSetCreateResponse>({
        provider: 'meta_ads',
        operation: 'create_ad_set',
        url: `${GRAPH}/${params.adAccountId}/adsets`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: jsonForm(body),
        clientId,
      });
    },
  );
}

export type CreateLeadFormParams = {
  pageId: string;
  pageAccessToken: string;
  name: string;
  questions: Array<{
    type: string;
    key?: string;
    label?: string;
  }>;
  privacyPolicyUrl: string;
  /** Optional: thank-you screen, intro screen, follow-up action. */
  followUpActionUrl?: string;
};

/** Create a Meta lead form attached to a Page. Returns the form id. Lead
 *  forms require a Page access token (the user token won't work). */
export async function createLeadForm(
  clientId: string,
  params: CreateLeadFormParams,
): Promise<IntegrationResult<MetaLeadFormCreateResponse>> {
  return callWithToken<MetaLeadFormCreateResponse>(
    clientId,
    'meta_ads',
    async () => {
      // Page token, not user token. callWithToken still provides the right
      // observability + retry plumbing through callExternal.
      const body: Record<string, unknown> = {
        access_token: params.pageAccessToken,
        name: params.name,
        questions: params.questions,
        privacy_policy: { url: params.privacyPolicyUrl },
      };
      if (params.followUpActionUrl) body.follow_up_action_url = params.followUpActionUrl;
      return callExternal<MetaLeadFormCreateResponse>({
        provider: 'meta_ads',
        operation: 'create_lead_form',
        url: `${GRAPH}/${params.pageId}/leadgen_forms`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: jsonForm(body),
        clientId,
      });
    },
  );
}

export type CreateAdCreativeParams = {
  adAccountId: string;
  name: string;
  pageId: string;
  /** The lead form id — wired into the creative's call-to-action. Set
   *  for the in-Meta lead form objective; omit for the landing-page
   *  objective (Meta routes the click to `linkUrl` instead). */
  leadFormId?: string | null;
  /** Headline / primary copy / description. */
  headline: string;
  primaryText: string;
  description?: string;
  /** Image hash (uploaded separately) or video id. For V1 the template
   *  provides ready-made image hashes; later we'll upload customer
   *  imagery and capture the returned hash. Ignored when
   *  `childAttachments` is set (carousel format). */
  imageHash?: string;
  /** Destination URL — irrelevant for lead-form ads but Meta still
   *  requires SOMETHING; defaults to the customer's website. For the
   *  landing-page objective this is the ad's actual destination. */
  linkUrl: string;
  ctaType?: string;
  /** V1.4c — when set, the creative is a CAROUSEL ad with N image
   *  cards. The top-level `imageHash` is ignored; instead each card
   *  carries its own `imageHash` + optional per-card copy. Meta
   *  requires 2-10 cards. The shared post body (primaryText) still
   *  sits above the carousel. */
  childAttachments?: Array<{
    imageHash: string;
    /** Per-card headline. Falls back to the creative's top-level
     *  `headline` when omitted. */
    headline?: string;
    /** Per-card subtitle. Falls back to top-level `description` when
     *  omitted. */
    description?: string;
    /** Per-card click destination. Falls back to the creative's
     *  `linkUrl` when omitted. */
    linkUrl?: string;
  }>;
};

export async function createAdCreative(
  clientId: string,
  params: CreateAdCreativeParams,
): Promise<IntegrationResult<MetaCreativeCreateResponse>> {
  return callWithToken<MetaCreativeCreateResponse>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      // call_to_action.value shape depends on the objective:
      //   • Lead form on Meta  → { lead_gen_form_id, link }
      //   • Landing page       → { link } (Meta routes the click to
      //                           the URL; Meta Pixel `Lead` event on
      //                           the customer's page is what closes
      //                           the loop for optimisation).
      const ctaValue: Record<string, unknown> = { link: params.linkUrl };
      if (params.leadFormId) ctaValue.lead_gen_form_id = params.leadFormId;
      const linkData: Record<string, unknown> = {
        message: params.primaryText,
        link: params.linkUrl,
        call_to_action: {
          type: params.ctaType ?? 'LEARN_MORE',
          value: ctaValue,
        },
      };
      if (params.childAttachments && params.childAttachments.length > 0) {
        // Carousel: omit top-level image_hash / name / description.
        // Each child carries its own copy + image + per-card CTA. We
        // copy the top-level CTA shape onto each card so the lead-form
        // id (when set) is per-card valid — clicking any card opens
        // the same form for lead_form_meta, or routes to the per-card
        // link for lead_form_landing.
        linkData.child_attachments = params.childAttachments.map((card) => {
          const cardLink = card.linkUrl ?? params.linkUrl;
          const cardCtaValue: Record<string, unknown> = { link: cardLink };
          if (params.leadFormId) cardCtaValue.lead_gen_form_id = params.leadFormId;
          const out: Record<string, unknown> = {
            link: cardLink,
            image_hash: card.imageHash,
            call_to_action: {
              type: params.ctaType ?? 'LEARN_MORE',
              value: cardCtaValue,
            },
          };
          const cardName = card.headline ?? params.headline;
          if (cardName) out.name = cardName;
          const cardDesc = card.description ?? params.description;
          if (cardDesc) out.description = cardDesc;
          return out;
        });
        // Optimised reorder by Meta — surfaces the winning card first
        // on subsequent impressions.
        linkData.multi_share_optimized = true;
      } else {
        // Single-image: top-level image_hash + name + description.
        linkData.name = params.headline;
        if (params.description) linkData.description = params.description;
        if (params.imageHash) linkData.image_hash = params.imageHash;
      }
      const body: Record<string, unknown> = {
        access_token: accessToken,
        name: params.name,
        object_story_spec: {
          page_id: params.pageId,
          link_data: linkData,
        },
      };
      return callExternal<MetaCreativeCreateResponse>({
        provider: 'meta_ads',
        operation: 'create_ad_creative',
        url: `${GRAPH}/${params.adAccountId}/adcreatives`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: jsonForm(body),
        clientId,
      });
    },
  );
}

export type CreateAdParams = {
  adAccountId: string;
  adSetId: string;
  creativeId: string;
  name: string;
  status?: 'ACTIVE' | 'PAUSED';
};

export async function createAd(
  clientId: string,
  params: CreateAdParams,
): Promise<IntegrationResult<MetaAdCreateResponse>> {
  return callWithToken<MetaAdCreateResponse>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const body = {
        access_token: accessToken,
        name: params.name,
        adset_id: params.adSetId,
        creative: { creative_id: params.creativeId },
        status: params.status ?? 'PAUSED',
      };
      return callExternal<MetaAdCreateResponse>({
        provider: 'meta_ads',
        operation: 'create_ad',
        url: `${GRAPH}/${params.adAccountId}/ads`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: jsonForm(body),
        clientId,
      });
    },
  );
}

// --- image upload (Phase 7.5 launch wizard) ---------------------------------
//
// Meta's /act_{id}/adimages endpoint accepts EITHER raw bytes or a public
// URL Meta's servers fetch. We pass the URL — the operator-uploaded image
// already lives in Supabase Storage (uploadAdImage browser helper writes
// it there, see upload-ad-image.ts), so Meta just pulls from there. The
// returned `image_hash` is what createAdCreative needs.
//
// Meta's response shape: `{ images: { '<url-or-name>': { hash, url } } }`
// — the key is the URL we passed (or a name we provided). We extract the
// single hash and return it.

export type UploadImageResult = { imageHash: string };

/** Upload an image to a Meta ad account by URL. Returns the resulting
 *  image_hash (used as creative.link_data.image_hash on createAdCreative).
 *  Meta dedupes hashes within an ad account — uploading the same URL
 *  twice returns the same hash, so this is idempotent. */
export async function uploadImageToMeta(
  clientId: string,
  adAccountId: string,
  imageUrl: string,
): Promise<IntegrationResult<UploadImageResult>> {
  return callWithToken<UploadImageResult>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const result = await callExternal<{
        images?: Record<string, { hash?: string; url?: string }>;
      }>({
        provider: 'meta_ads',
        operation: 'upload_ad_image',
        url: `${GRAPH}/${adAccountId}/adimages`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: form({ access_token: accessToken, url: imageUrl }),
        clientId,
      });
      if (!result.ok) return result;
      // Meta's response keys the images map by the URL we sent. Just
      // grab the first entry's hash — there's only ever one.
      const images = result.data.images ?? {};
      const firstKey = Object.keys(images)[0];
      const hash = firstKey ? images[firstKey]?.hash : undefined;
      if (!hash) {
        return {
          ok: false,
          error: {
            class: 'non_retryable',
            message: 'Meta returned no image_hash on adimages response.',
            provider: 'meta_ads',
            operation: 'upload_ad_image',
            status: result.status,
          },
        };
      }
      return { ok: true, data: { imageHash: hash }, status: result.status };
    },
  );
}

/** Resolve the Page Access Token for a Page the connected user manages.
 *  Public wrapper around the internal fetchPageAccessToken helper — the
 *  launch orchestrator needs this for createLeadForm (Page-level CRUD
 *  requires a Page token, not the user token). */
export async function getPageAccessToken(
  clientId: string,
  pageId: string,
): Promise<IntegrationResult<string>> {
  return callWithToken<string>(
    clientId,
    'meta_ads',
    async (accessToken) => fetchPageAccessToken(clientId, pageId, accessToken),
  );
}

// --- targeting autocomplete (Phase 7.5 Session 1.1) -------------------------
//
// Meta's `/search` endpoint resolves free-text strings to the structured
// targeting ids Meta's API expects. Three modes used by Webnua's launch
// wizard:
//   • type=adgeolocation  — city + region lookup; returns `key` strings
//     that geo_locations.cities[] accepts
//   • type=adinterest     — interest lookup; returns `id` + `name` that
//     flexible_spec.interests[] accepts
//
// The wizard's step 2 calls these via a debounced autocomplete; no
// queries fire until the operator types ≥ 2 chars.

export interface MetaAdGeoLocation {
  key?: string;             // Meta's geo id (e.g. '2270676' for Perth)
  name?: string;
  type?: string;            // 'city' | 'region' | 'country' | 'subcity' | …
  country_code?: string;
  country_name?: string;
  region?: string;
  region_id?: string;
  supports_region?: boolean;
  supports_city?: boolean;
}

export interface MetaAdInterest {
  id?: string;              // Meta's numeric interest id (string-encoded)
  name?: string;
  audience_size_lower_bound?: number;
  audience_size_upper_bound?: number;
  path?: string[];          // Meta's taxonomy path, useful for disambiguation
  description?: string;
  topic?: string;
}

/** City / region autocomplete. Operator types "Perth" → returns the
 *  matching geo locations from Meta. The wizard filters to type='city'
 *  by default; the route exposes both shapes. `countryCode` narrows the
 *  search to one country (recommended — otherwise "London" returns 30+
 *  Londons across the world). */
export async function searchAdGeoLocations(
  clientId: string,
  query: string,
  options?: { countryCode?: string; limit?: number; locationTypes?: string[] },
): Promise<IntegrationResult<MetaAdGeoLocation[]>> {
  const limit = options?.limit ?? 12;
  const locationTypes = options?.locationTypes ?? ['city', 'region'];
  return callWithToken<MetaAdGeoLocation[]>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/search?${form({
        access_token: accessToken,
        type: 'adgeolocation',
        q: query,
        limit,
        location_types: JSON.stringify(locationTypes),
        country_code: options?.countryCode ?? null,
      })}`;
      const result = await callExternal<{ data?: MetaAdGeoLocation[] }>({
        provider: 'meta_ads',
        operation: 'search_ad_geolocation',
        url,
        method: 'GET',
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.data ?? [], status: result.status };
    },
  );
}

// --- pixel discovery (Phase 7.5 · Session 1.2) -------------------------------
//
// The landing-page objective routes ad clicks to the customer's own
// website; Meta needs a Pixel id on the ad set's promoted_object so it
// can optimise against the customer's Lead conversion event. This
// endpoint lists every pixel the connected user can see on a given ad
// account; the wizard's pixel picker consumes the shaped output.

export interface MetaPixel {
  id?: string;
  name?: string;
  code?: string;             // the fbq init string (rarely used by Webnua)
  is_unavailable?: boolean;
  last_fired_time?: string;
  data_use_setting?: string;
}

/** List every Meta Pixel reachable from the customer's ad account. The
 *  /adspixels endpoint returns the pixels the connected user has
 *  permission to read — for a properly-shared ad account this is the
 *  set the wizard's picker offers. Excludes is_unavailable rows at the
 *  route layer (not here). */
export async function listAdsPixels(
  clientId: string,
  adAccountId: string,
): Promise<IntegrationResult<MetaPixel[]>> {
  return callWithToken<MetaPixel[]>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/${adAccountId}/adspixels?${form({
        access_token: accessToken,
        fields: 'id,name,code,is_unavailable,last_fired_time,data_use_setting',
        limit: 50,
      })}`;
      const result = await callExternal<{ data?: MetaPixel[] }>({
        provider: 'meta_ads',
        operation: 'list_ads_pixels',
        url,
        method: 'GET',
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.data ?? [], status: result.status };
    },
  );
}

/** Interest autocomplete. Operator types "plumbing" → returns matching
 *  interest entries with their numeric id, name, audience size estimate,
 *  and taxonomy path. The launch orchestrator passes the resolved ids
 *  into the ad set's `flexible_spec.interests[]` so Meta knows what
 *  audience to target. */
export async function searchAdInterests(
  clientId: string,
  query: string,
  options?: { limit?: number },
): Promise<IntegrationResult<MetaAdInterest[]>> {
  const limit = options?.limit ?? 12;
  return callWithToken<MetaAdInterest[]>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/search?${form({
        access_token: accessToken,
        type: 'adinterest',
        q: query,
        limit,
      })}`;
      const result = await callExternal<{ data?: MetaAdInterest[] }>({
        provider: 'meta_ads',
        operation: 'search_ad_interest',
        url,
        method: 'GET',
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.data ?? [], status: result.status };
    },
  );
}

// --- status flips ------------------------------------------------------------

async function setObjectStatus(
  clientId: string,
  metaObjectId: string,
  status: 'ACTIVE' | 'PAUSED',
  operation: string,
): Promise<IntegrationResult<{ success?: boolean }>> {
  return callWithToken<{ success?: boolean }>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      return callExternal<{ success?: boolean }>({
        provider: 'meta_ads',
        operation,
        url: `${GRAPH}/${metaObjectId}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: form({ access_token: accessToken, status }),
        clientId,
      });
    },
  );
}

/** Update a campaign's daily budget. Campaigns launched in-app run CBO, so
 *  the budget lives at the campaign level; cents in the ad account currency.
 *  The ads-autopilot approve path is the main caller. */
export function updateCampaignDailyBudget(
  clientId: string,
  metaCampaignId: string,
  dailyBudgetCents: number,
): Promise<IntegrationResult<{ success?: boolean }>> {
  return callWithToken<{ success?: boolean }>(
    clientId,
    'meta_ads',
    async (accessToken) =>
      callExternal<{ success?: boolean }>({
        provider: 'meta_ads',
        operation: 'update_campaign_budget',
        url: `${GRAPH}/${metaCampaignId}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: form({
          access_token: accessToken,
          daily_budget: String(Math.round(dailyBudgetCents)),
        }),
        clientId,
      }),
  );
}

// --- Business Asset Sharing (migration 0113) --------------------------------
//
// After OAuth + ad-account pick, we add Webnua's Business Manager as a
// partner on the customer's ad account + Page. From that point on,
// operators logged into Meta with their own personal account see the
// customer's assets natively in their own Ads Manager — no deep-link,
// no extra invite. This is the standard agency-onboarding shape Meta
// has documented for years; the customer keeps ownership at all times
// and can revoke from their Business Manager. Both endpoints require
// `business_management` (already requested) and the corresponding
// ads_management / pages_manage_ads permission (also requested).

/** Tasks Webnua's BM receives on the customer's ad account when shared.
 *  Meta's closed set for ad-account agencies is
 *  {MANAGE, ADVERTISE, ANALYZE, DRAFT, AA_ANALYZE}. V1 picks the trio
 *  that covers full operator workflow without the niche extras —
 *  MANAGE for governance, ADVERTISE for campaign builds, ANALYZE for
 *  reporting. Lead retrieval is granted separately (the user-level
 *  `leads_retrieval` permission + Page leadgen access, NOT an ad-account
 *  agency task — `MANAGE_LEADS` does not exist in this enum). */
const AD_ACCOUNT_TASKS = ['MANAGE', 'ADVERTISE', 'ANALYZE'] as const;

/** Tasks Webnua's BM receives on the customer's Page. V1 = full
 *  management plus messaging (lead-gen ads frequently funnel into
 *  Messenger, so MESSAGING + ADVERTISE is the operative set). */
const PAGE_TASKS = ['MANAGE', 'CREATE_CONTENT', 'ADVERTISE', 'ANALYZE', 'MESSAGING'] as const;

/** Share an ad account with Webnua's Business Manager so operators
 *  see it in their own Ads Manager. Idempotent on Meta's side — calling
 *  twice does not error, the second call is a no-op when the share
 *  already exists. */
export async function shareAdAccountWithWebnua(
  clientId: string,
  adAccountId: string,
  webnuaBusinessId: string,
): Promise<IntegrationResult<{ success?: boolean }>> {
  return callWithToken<{ success?: boolean }>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      return callExternal<{ success?: boolean }>({
        provider: 'meta_ads',
        operation: 'share_ad_account_with_webnua',
        url: `${GRAPH}/${adAccountId}/agencies`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: jsonForm({
          access_token: accessToken,
          business: webnuaBusinessId,
          permitted_tasks: AD_ACCOUNT_TASKS,
        }),
        clientId,
      });
    },
  );
}

/** Fetch a Page-scoped access token using the user access token. The
 *  user must be a Page admin (always true in our flow — the customer
 *  picked the Page from their own list). Required by every Page-level
 *  write endpoint, including /{page_id}/agencies. */
async function fetchPageAccessToken(
  clientId: string,
  pageId: string,
  userAccessToken: string,
): Promise<IntegrationResult<string>> {
  const result = await callExternal<{ access_token?: string }>({
    provider: 'meta_ads',
    operation: 'get_page_access_token',
    url: `${GRAPH}/${pageId}?${form({
      access_token: userAccessToken,
      fields: 'access_token',
    })}`,
    method: 'GET',
    clientId,
  });
  if (!result.ok) return result;
  const pageToken = result.data.access_token;
  if (!pageToken) {
    return {
      ok: false,
      error: {
        class: 'non_retryable',
        message:
          'Page access token not returned — the connected user may not be a Page admin.',
        provider: 'meta_ads',
        operation: 'get_page_access_token',
        status: result.status,
      },
    };
  }
  return { ok: true, data: pageToken, status: result.status };
}

/** Share a Page with Webnua's Business Manager so lead-gen ads attached
 *  to this Page can be managed from operator Ads Managers. Two-step:
 *  swap the user token for a Page Access Token (Meta requires it on
 *  /{page_id}/agencies — error #190 without it), then call the share
 *  endpoint with the page-scoped token. */
export async function sharePageWithWebnua(
  clientId: string,
  pageId: string,
  webnuaBusinessId: string,
): Promise<IntegrationResult<{ success?: boolean }>> {
  return callWithToken<{ success?: boolean }>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const tokenSwap = await fetchPageAccessToken(clientId, pageId, accessToken);
      if (!tokenSwap.ok) return tokenSwap;
      return callExternal<{ success?: boolean }>({
        provider: 'meta_ads',
        operation: 'share_page_with_webnua',
        url: `${GRAPH}/${pageId}/agencies`,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        rawBody: jsonForm({
          access_token: tokenSwap.data,
          business: webnuaBusinessId,
          permitted_tasks: PAGE_TASKS,
        }),
        clientId,
      });
    },
  );
}

/** Revoke Webnua's partner access to an ad account. Called on
 *  operator-initiated disconnect; the customer can also revoke from
 *  their own Business Manager. */
export async function revokeAdAccountFromWebnua(
  clientId: string,
  adAccountId: string,
  webnuaBusinessId: string,
): Promise<IntegrationResult<{ success?: boolean }>> {
  return callWithToken<{ success?: boolean }>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      return callExternal<{ success?: boolean }>({
        provider: 'meta_ads',
        operation: 'revoke_ad_account_from_webnua',
        url: `${GRAPH}/${adAccountId}/agencies?${form({
          access_token: accessToken,
          business: webnuaBusinessId,
        })}`,
        method: 'DELETE',
        clientId,
      });
    },
  );
}

/** Revoke Webnua's partner access to a Page. Sibling of
 *  revokeAdAccountFromWebnua — same token-swap shape as
 *  sharePageWithWebnua (the DELETE half of /{page_id}/agencies also
 *  requires a Page Access Token). */
export async function revokePageFromWebnua(
  clientId: string,
  pageId: string,
  webnuaBusinessId: string,
): Promise<IntegrationResult<{ success?: boolean }>> {
  return callWithToken<{ success?: boolean }>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const tokenSwap = await fetchPageAccessToken(clientId, pageId, accessToken);
      if (!tokenSwap.ok) return tokenSwap;
      return callExternal<{ success?: boolean }>({
        provider: 'meta_ads',
        operation: 'revoke_page_from_webnua',
        url: `${GRAPH}/${pageId}/agencies?${form({
          access_token: tokenSwap.data,
          business: webnuaBusinessId,
        })}`,
        method: 'DELETE',
        clientId,
      });
    },
  );
}

export function pauseCampaign(clientId: string, metaCampaignId: string) {
  return setObjectStatus(clientId, metaCampaignId, 'PAUSED', 'pause_campaign');
}
export function activateCampaign(clientId: string, metaCampaignId: string) {
  return setObjectStatus(clientId, metaCampaignId, 'ACTIVE', 'activate_campaign');
}
export function pauseAd(clientId: string, metaAdId: string) {
  return setObjectStatus(clientId, metaAdId, 'PAUSED', 'pause_ad');
}
export function activateAd(clientId: string, metaAdId: string) {
  return setObjectStatus(clientId, metaAdId, 'ACTIVE', 'activate_ad');
}
export function pauseAdSet(clientId: string, metaAdSetId: string) {
  return setObjectStatus(clientId, metaAdSetId, 'PAUSED', 'pause_ad_set');
}
export function activateAdSet(clientId: string, metaAdSetId: string) {
  return setObjectStatus(clientId, metaAdSetId, 'ACTIVE', 'activate_ad_set');
}

// --- read ops ----------------------------------------------------------------

/** List all campaigns on an ad account. Used by the `meta_sync_campaigns`
 *  ingest job to discover campaigns built in Meta Ads Manager and bring
 *  them into Webnua's `public.campaigns` + `meta_campaigns` tables.
 *
 *  The `act_*` prefixed ad-account id (Webnua's canonical form) is fine to
 *  pass — Meta accepts both `act_NNNNN` and the bare numeric id on this
 *  endpoint. Paging is handled by Meta automatically up to `limit`. */
export async function listCampaignsForAdAccount(
  clientId: string,
  adAccountId: string,
): Promise<IntegrationResult<MetaCampaign[]>> {
  return callWithToken<MetaCampaign[]>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/${adAccountId}/campaigns?${form({
        access_token: accessToken,
        fields:
          'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time',
        limit: 200,
      })}`;
      const result = await callExternal<{ data?: MetaCampaign[] }>({
        provider: 'meta_ads',
        operation: 'list_campaigns_for_ad_account',
        url,
        method: 'GET',
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.data ?? [], status: result.status };
    },
  );
}

/** Ad-with-creative slice returned by `listAdsForCampaign`. Used by the
 *  lead-form discovery walk: every lead-gen ad's creative carries a
 *  `lead_gen_form_id` somewhere — either on the modern `form_id` field
 *  directly on the creative, or nested under
 *  `object_story_spec.link_data.lead_gen_form_id` (the older shape).
 *  Both are returned by Meta on the same request; the resolver checks
 *  each. */
export interface MetaAdWithCreative {
  id?: string;
  name?: string;
  status?: string;
  creative?: {
    id?: string;
    name?: string;
    /** Newer creatives carry the form id directly. */
    form_id?: string;
    /** Older creatives nest it under the story spec. */
    object_story_spec?: {
      link_data?: { lead_gen_form_id?: string };
    };
  };
}

/** List ads on a campaign with the bits needed to resolve a lead form.
 *  The lead-form discovery walk uses this — for each ad, look for a
 *  `form_id` on the creative (either modern or nested shape). The first
 *  ad with a non-null form id wins; we treat that as the campaign's
 *  primary lead form. */
export async function listAdsForCampaign(
  clientId: string,
  metaCampaignId: string,
): Promise<IntegrationResult<MetaAdWithCreative[]>> {
  return callWithToken<MetaAdWithCreative[]>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/${metaCampaignId}/ads?${form({
        access_token: accessToken,
        fields:
          'id,name,status,creative{id,name,form_id,object_story_spec{link_data{lead_gen_form_id}}}',
        limit: 100,
      })}`;
      const result = await callExternal<{ data?: MetaAdWithCreative[] }>({
        provider: 'meta_ads',
        operation: 'list_ads_for_campaign',
        url,
        method: 'GET',
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.data ?? [], status: result.status };
    },
  );
}

/** Lead-form details — name, page id, and the question array (which
 *  describes the fields the customer fills in). The questions list is
 *  persisted to `meta_lead_forms.fields` so the lead-ingest job knows
 *  how to map field values to display labels without extra API calls. */
export interface MetaLeadFormDetail {
  id?: string;
  name?: string;
  status?: string;
  page_id?: string;
  questions?: Array<{
    key?: string;
    label?: string;
    type?: string;
    options?: Array<{ key?: string; value?: string }>;
  }>;
}

/** Fetch a lead form's details by Meta form id. Called once per
 *  newly-discovered lead form during `meta_sync_campaigns` so we have
 *  the name + page id + question list cached locally. */
export async function getLeadForm(
  clientId: string,
  metaFormId: string,
): Promise<IntegrationResult<MetaLeadFormDetail>> {
  return callWithToken<MetaLeadFormDetail>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/${metaFormId}?${form({
        access_token: accessToken,
        fields: 'id,name,status,page_id,questions',
      })}`;
      return callExternal<MetaLeadFormDetail>({
        provider: 'meta_ads',
        operation: 'get_lead_form',
        url,
        method: 'GET',
        clientId,
      });
    },
  );
}

/** Fetch the live campaign object (status, effective_status, budget,
 *  schedule). Used by the daily insights sync to refresh local status. */
export async function getCampaign(
  clientId: string,
  metaCampaignId: string,
): Promise<IntegrationResult<MetaCampaign>> {
  return callWithToken<MetaCampaign>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/${metaCampaignId}?${form({
        access_token: accessToken,
        fields:
          'id,name,objective,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time,created_time',
      })}`;
      return callExternal<MetaCampaign>({
        provider: 'meta_ads',
        operation: 'get_campaign',
        url,
        method: 'GET',
        clientId,
      });
    },
  );
}

export type DateRange = { since: string; until: string };

/** Pull insights for a campaign over a date range. Meta returns one row
 *  per day when level='campaign' + time_increment=1.
 *
 *  Webnua uses time_increment=1 (per-day) and asks for ALL the metrics
 *  the dashboard renders (impressions, clicks, spend, leads action count,
 *  CPL, CTR). Returning the raw payload too so future expansions of the
 *  insights table don't require a backfill. */
export async function getCampaignInsights(
  clientId: string,
  metaCampaignId: string,
  range: DateRange,
): Promise<IntegrationResult<MetaInsightsResponse>> {
  return callWithToken<MetaInsightsResponse>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const url = `${GRAPH}/${metaCampaignId}/insights?${form({
        access_token: accessToken,
        time_range: JSON.stringify(range),
        time_increment: 1,
        level: 'campaign',
        fields:
          'date_start,date_stop,impressions,clicks,spend,actions,cost_per_action_type,ctr,cpc,cpm',
        limit: 100,
      })}`;
      return callExternal<MetaInsightsResponse>({
        provider: 'meta_ads',
        operation: 'get_campaign_insights',
        url,
        method: 'GET',
        clientId,
      });
    },
  );
}

/** Fetch lead-form submissions created since the last sync. Meta's
 *  /leads endpoint paginates by created_time DESC. The `sinceUnix` param
 *  filters by Unix timestamp (Meta accepts this on the leads endpoint via
 *  the `filtering` parameter). */
export async function getLeads(
  clientId: string,
  metaFormId: string,
  sinceUnix?: number,
): Promise<IntegrationResult<MetaLeadsResponse>> {
  return callWithToken<MetaLeadsResponse>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const params: Record<string, string | number> = {
        access_token: accessToken,
        fields:
          'id,created_time,ad_id,ad_name,adset_id,campaign_id,form_id,field_data',
        limit: 100,
      };
      if (sinceUnix && sinceUnix > 0) {
        params.filtering = JSON.stringify([
          { field: 'time_created', operator: 'GREATER_THAN', value: sinceUnix },
        ]);
      }
      const url = `${GRAPH}/${metaFormId}/leads?${form(params)}`;
      return callExternal<MetaLeadsResponse>({
        provider: 'meta_ads',
        operation: 'get_leads',
        url,
        method: 'GET',
        clientId,
      });
    },
  );
}
