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
  /** Daily budget in minor units. */
  dailyBudgetCents: number;
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
        daily_budget: params.dailyBudgetCents,
        optimization_goal: params.optimizationGoal ?? 'LEAD_GENERATION',
        billing_event: params.billingEvent ?? 'IMPRESSIONS',
        bid_strategy: params.bidStrategy ?? 'LOWEST_COST_WITHOUT_CAP',
        status: params.status ?? 'PAUSED',
        targeting: params.targeting,
      };
      if (params.startTime) body.start_time = params.startTime;
      if (params.endTime) body.end_time = params.endTime;
      if (params.promotedObjectPageId) {
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
  /** The lead form id — wired into the creative's call-to-action. */
  leadFormId: string;
  /** Headline / primary copy / description. */
  headline: string;
  primaryText: string;
  description?: string;
  /** Image hash (uploaded separately) or video id. For V1 the template
   *  provides ready-made image hashes; later we'll upload customer
   *  imagery and capture the returned hash. */
  imageHash?: string;
  /** Destination URL — irrelevant for lead-form ads but Meta still
   *  requires SOMETHING; defaults to the customer's website. */
  linkUrl: string;
  ctaType?: string;
};

export async function createAdCreative(
  clientId: string,
  params: CreateAdCreativeParams,
): Promise<IntegrationResult<MetaCreativeCreateResponse>> {
  return callWithToken<MetaCreativeCreateResponse>(
    clientId,
    'meta_ads',
    async (accessToken) => {
      const linkData: Record<string, unknown> = {
        message: params.primaryText,
        link: params.linkUrl,
        name: params.headline,
        call_to_action: {
          type: params.ctaType ?? 'LEARN_MORE',
          value: { lead_gen_form_id: params.leadFormId, link: params.linkUrl },
        },
      };
      if (params.description) linkData.description = params.description;
      if (params.imageHash) linkData.image_hash = params.imageHash;
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

// --- read ops ----------------------------------------------------------------

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
