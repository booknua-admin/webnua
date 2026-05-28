'use client';

// =============================================================================
// Meta Ads — operator + customer UI data layer.
//
// Phase 7 Meta Ads. Reads via the RLS-scoped browser client (table is not
// yet in the generated Database type, hence the untyped cast — same pattern
// as use-gbp.ts / use-sms.ts). Mutations POST the operator routes under
// /api/integrations/meta_ads/*.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type { ClientMetaAdAccountRow, MetaAdsInsightsRow } from './types';

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Resolve the signed-in user's Supabase access token — the Meta routes
 *  authenticate via `requireClientAccess` / `requireOperatorForClient`,
 *  both of which read the bearer token from the request. Mirrors the GBP
 *  use-gbp.ts pattern; previous omission of this header was the source
 *  of the picker's "unauthenticated" error. */
async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out — sign in again.');
  return token;
}

/** Map a server error code to a sentence the picker UI can show as-is. */
function errorMessage(code: string | undefined, status: number): string {
  switch (code) {
    case 'meta-not-configured':
      return 'Meta Ads is not configured yet — its OAuth app credentials are missing.';
    case 'meta-list-ad-accounts-failed':
      return 'Could not list ad accounts — try reconnecting Meta.';
    case 'meta-get-ad-account-failed':
      return 'Could not load that ad account from Meta — try again.';
    case 'select-write-failed':
      return 'Could not save the ad-account selection.';
    case 'launch-failed':
      return 'Meta rejected the launch — review the campaign in Ads Manager.';
    case 'status-flip-failed':
      return 'Could not change the campaign status on Meta.';
    case 'forbidden':
    case 'forbidden-client':
      return 'You do not have access to this client.';
    case 'unauthenticated':
      return 'You are signed out — sign in again.';
    default:
      return `Something went wrong (${code ?? status}).`;
  }
}

/** Error thrown by `postJson` when the route returns a structured failure
 *  body. Carries `error` (the code string) + the route's optional `step` /
 *  `detail` / `partial` fields so callers (e.g. the launch modal) can
 *  surface which Meta step failed instead of a one-line `Error.message`. */
export class MetaRouteError extends Error {
  readonly code: string | undefined;
  readonly status: number;
  readonly step: string | undefined;
  readonly detail: string | undefined;
  readonly partial: Record<string, unknown> | undefined;
  constructor(input: {
    code: string | undefined;
    status: number;
    step?: string;
    detail?: string;
    partial?: Record<string, unknown>;
    message: string;
  }) {
    super(input.message);
    this.name = 'MetaRouteError';
    this.code = input.code;
    this.status = input.status;
    this.step = input.step;
    this.detail = input.detail;
    this.partial = input.partial;
  }
}

async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = json.error as string | undefined;
    throw new MetaRouteError({
      code,
      status: response.status,
      step: typeof json.step === 'string' ? json.step : undefined,
      detail: typeof json.detail === 'string' ? json.detail : undefined,
      partial:
        json.partial && typeof json.partial === 'object'
          ? (json.partial as Record<string, unknown>)
          : undefined,
      message: errorMessage(code, response.status),
    });
  }
  return json;
}

/** PGRST205 = schema-cache missing table — treat as "no data yet" so a
 *  deployment that hasn't applied the Meta migrations yet shows the empty
 *  state instead of an error. */
function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'PGRST205';
}

const adAccountKey = (clientId: string | null) => ['meta-ad-account', clientId] as const;
const campaignsKey = (clientId: string | null) => ['meta-campaigns', clientId] as const;
const insightsKey = (clientId: string | null, days: number) =>
  ['meta-insights', clientId, days] as const;

// --- reads -------------------------------------------------------------------

async function fetchAdAccount(clientId: string): Promise<ClientMetaAdAccountRow | null> {
  const { data, error } = await db()
    .from('client_meta_ad_accounts')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error && !isMissingTableError(error)) throw normalizeError(error);
  return (data as ClientMetaAdAccountRow | null) ?? null;
}

export function useClientMetaAdAccount(clientId: string | null) {
  return useQuery({
    queryKey: adAccountKey(clientId),
    queryFn: () => fetchAdAccount(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

async function fetchRecentInsights(
  clientId: string,
  days: number,
): Promise<MetaAdsInsightsRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await db()
    .from('meta_ads_insights')
    .select('*')
    .eq('client_id', clientId)
    .gte('date_recorded', since)
    .order('date_recorded', { ascending: true });
  if (error && !isMissingTableError(error)) throw normalizeError(error);
  return (data as MetaAdsInsightsRow[] | null) ?? [];
}

export function useClientMetaInsights(clientId: string | null, days = 30) {
  return useQuery({
    queryKey: insightsKey(clientId, days),
    queryFn: () => fetchRecentInsights(clientId as string, days),
    enabled: clientId != null && clientId.length > 0,
  });
}

// --- derived helpers (used by widgets) ---------------------------------------

export type MetaPerformanceSummary = {
  spendCents: number;
  leads: number;
  cplCents: number | null;
  impressions: number;
  clicks: number;
  /** Per-day series (oldest first) used by the sparkline. */
  series: Array<{ date: string; leads: number; spendCents: number }>;
};

export function summariseInsights(rows: MetaAdsInsightsRow[]): MetaPerformanceSummary {
  let spendCents = 0;
  let leads = 0;
  let impressions = 0;
  let clicks = 0;
  for (const r of rows) {
    spendCents += r.spend_cents ?? 0;
    leads += r.leads ?? 0;
    impressions += r.impressions ?? 0;
    clicks += r.clicks ?? 0;
  }
  return {
    spendCents,
    leads,
    cplCents: leads > 0 ? Math.round(spendCents / leads) : null,
    impressions,
    clicks,
    series: rows.map((r) => ({
      date: r.date_recorded,
      leads: r.leads ?? 0,
      spendCents: r.spend_cents ?? 0,
    })),
  };
}

// --- mutations (POST the operator routes) ------------------------------------

/** Mapped ad-account row from the /ad-accounts route. The route shapes
 *  Meta's raw `MetaAdAccount` into a snake_case-free display object so the
 *  picker UI doesn't have to know Meta's quirks. */
export type AdAccountPickerOption = {
  id: string | undefined;
  accountId: string | undefined;
  name: string | undefined;
  currency: string | undefined;
  statusCode: number | undefined;
  statusLabel: string | undefined;
  timezone: string | undefined;
  business: { id?: string; name?: string } | undefined;
  amountSpent: string | undefined;
  balance: string | undefined;
};

/** Mapped Page row from the same route — includes the page access token
 *  the launch flow needs to attach an ad to this Page. */
export type PagePickerOption = {
  id: string | undefined;
  name: string | undefined;
  accessToken: string | undefined;
  tasks: string[] | undefined;
};

export type AdAccountPickerResponse = {
  adAccounts: AdAccountPickerOption[];
  pages: PagePickerOption[];
  pagesError?: { detail: string; class: string } | null;
};

/** List ad accounts the connected Meta user can manage — the picker
 *  fetches this on mount. */
export function useListMetaAdAccounts() {
  return useMutation({
    mutationFn: async (input: { clientId: string }) => {
      return (await postJson('/api/integrations/meta_ads/ad-accounts', {
        action: 'list',
        clientId: input.clientId,
      })) as unknown as AdAccountPickerResponse;
    },
  });
}

/** Per-asset partner-share outcome returned by the select / share-retry
 *  routes. The picker confirmation step + the footer's partner-status
 *  indicator both consume this shape. */
export type ShareOutcomeDto =
  | { kind: 'active' }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; reason: string };

export type SharePartnerResponse = {
  adAccount: ShareOutcomeDto;
  page: ShareOutcomeDto;
};

/** Pick the ad account + Page to wire to this client. Stores the
 *  selection AND runs the Webnua-BM asset-share orchestrator inline —
 *  the route returns the per-asset partner outcome so the picker can
 *  show success / partial-success without a second round trip. */
export function useSelectMetaAdAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      adAccountId: string;
      customerAgreementEmail: string;
      pageId?: string | null;
      pageName?: string | null;
    }) => {
      const response = (await postJson(
        '/api/integrations/meta_ads/ad-accounts',
        { action: 'select', ...input },
      )) as unknown as { ok: boolean; partner: SharePartnerResponse };
      return response;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: adAccountKey(vars.clientId) });
    },
  });
}

/** Retry the Webnua-BM partner share when it failed on first attempt
 *  (e.g. META_WEBNUA_BUSINESS_ID was unset, or a transient Meta API
 *  error). Reads the persisted ad-account + page ids from the row, so
 *  the operator doesn't have to re-pick. */
export function useRetryMetaPartnerShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string }) => {
      const response = (await postJson(
        '/api/integrations/meta_ads/ad-accounts',
        { action: 'share-retry', clientId: input.clientId },
      )) as unknown as { ok: boolean; partner: SharePartnerResponse };
      return response;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: adAccountKey(vars.clientId) });
    },
  });
}

/** Revoke Webnua's partner access without disconnecting the OAuth
 *  connection. Used when the customer wants Webnua to step back but
 *  keep their data intact (rare; the more common path is full
 *  disconnect from /settings/integrations). */
export function useRevokeMetaPartnerShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string }) => {
      await postJson('/api/integrations/meta_ads/ad-accounts', {
        action: 'share-revoke',
        clientId: input.clientId,
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: adAccountKey(vars.clientId) });
    },
  });
}

/** In-app User Data Deletion — full revoke + purge of every Meta-sourced
 *  row for the client. Backs the "Disconnect & delete data" button on
 *  /settings/integrations. Returns the public confirmation URL so the
 *  UI can deep-link the customer to the status page. Required for
 *  Meta App Review compliance. */
export function useDeleteMetaData(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = (await postJson(
        '/api/integrations/meta_ads/data-deletion-self',
        { clientId },
      )) as unknown as { ok: boolean; url: string; confirmation_code: string };
      return response;
    },
    onSuccess: () => {
      // Every Meta-derived query is now stale — connections, ad account,
      // campaigns, insights. Invalidate the lot so the UI redraws empty.
      qc.invalidateQueries({ queryKey: adAccountKey(clientId) });
      qc.invalidateQueries({ queryKey: campaignsKey(clientId) });
      qc.invalidateQueries({ queryKey: insightsKey(clientId, 30) });
      qc.invalidateQueries({ queryKey: ['integration-connections', clientId] });
    },
  });
}

/** Discover campaigns on the connected ad account + upsert
 *  public.campaigns + meta_campaigns rows. Whole-account scope (no
 *  metaCampaignDbId); the per-campaign sync is `useSyncMetaCampaign`
 *  below. Same /sync route, different body shape. */
export function useSyncMetaAccountCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string }) => {
      await postJson('/api/integrations/meta_ads/sync', { clientId: input.clientId });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: ['campaigns', 'admin'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'client'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'sub-account'] });
    },
  });
}

// --- Phase 7.5 launch wizard -------------------------------------------------

/** Generate N ad creative variants from the operator's offer input via
 *  Sonnet. The wizard's step 4 calls this on "✦ Generate variants" +
 *  auto-fires on step entry. The wizard threads the customer's brand
 *  voice axes + website hero copy + services list into the draft so
 *  Sonnet draws from the customer's actual positioning, not just the
 *  one offer field. */
export function useDraftMetaAdVariants() {
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      offer: string;
      templateSlug: string;
      businessName: string;
      serviceArea: string;
      count?: number;
      /** Brand voice axes (1-5 each). When omitted the route falls
       *  back to neutral 3/3/3. */
      voiceFormality?: number;
      voiceUrgency?: number;
      voiceTechnicality?: number;
      /** Audience description from `brands.audience_line`. */
      audienceLine?: string;
      /** Services the business offers (from `brands.services` or
       *  `top_jobs_to_be_booked`). */
      services?: string[];
      /** Website hero copy excerpts (eyebrow + headline + sub) when
       *  the customer has a published site. Drawn from the home page's
       *  hero section. */
      websiteHeroCopy?: string;
      /** Existing tagline (from `brands.tagline` or `brands.offer`). */
      brandTagline?: string;
    }) => {
      const { draftMetaAdVariants } = await import('./creative-draft');
      return draftMetaAdVariants(input);
    },
  });
}

/** Operator-side targeting autocomplete proxy. Wraps the
 *  /targeting-search route — debounced in the consumer (the wizard
 *  uses 300ms). */
export type TargetingSearchResult = {
  id: string;
  label: string;
  sublabel?: string;
  audienceSize?: { lower: number; upper: number };
};

export function useSearchMetaTargeting() {
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      type: 'cities' | 'interests';
      query: string;
      countryCode?: string;
    }): Promise<TargetingSearchResult[]> => {
      if (input.query.trim().length < 2) return [];
      try {
        const response = (await postJson(
          '/api/integrations/meta_ads/targeting-search',
          input,
        )) as unknown as { results: TargetingSearchResult[] };
        return response.results ?? [];
      } catch (error) {
        // Treat as empty so the autocomplete just shows "no matches"
        // rather than blocking the operator with an error panel; the
        // error is still on the mutation object for debug.
        if (error instanceof MetaRouteError && error.code === 'query-too-short') {
          return [];
        }
        throw error;
      }
    },
  });
}

/** Browser-side upload of the operator's ad image to Supabase Storage.
 *  Returns the public URL + dimensions; the wizard then passes the URL
 *  to the launch route, which posts it to Meta's /adimages endpoint
 *  server-side. */
export function useUploadAdImage() {
  return useMutation({
    mutationFn: async (input: { clientId: string; file: File }) => {
      const { uploadAdImage } = await import('./upload-ad-image');
      const result = await uploadAdImage(input.clientId, input.file);
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}

/** Launch a Meta lead-form campaign. POSTs the wizard's full payload
 *  through to the launch route, which drives the orchestrator. */
export type LaunchCampaignPayload = {
  clientId: string;
  templateSlug: string;
  campaignName: string;
  targeting: {
    /** Cities resolved via Meta autocomplete (preferred over geoCenter
     *  — Meta optimises better on named cities). Each carries Meta's
     *  `key` + display label + per-city radius. */
    cities: Array<{ key: string; label: string; radiusKm: number }>;
    /** Interest ids resolved via Meta autocomplete — passed as
     *  flexible_spec.interests[] in the ad set spec. */
    interests: Array<{ id: string; name: string }>;
    /** Fallback: free-typed lat/lng + radius. Used when no cities
     *  resolve via autocomplete. */
    geoCenter?: { lat: number; lng: number } | null;
    radiusKm?: number | null;
    ageMin: number;
    ageMax: number;
    /** Free-form keyword tokens (training snapshot only — not passed
     *  to Meta when interests[] is populated). */
    interestTokens: string[];
    countries: string[];
  };
  dailyBudgetCents: number;
  startTimeIso: string;
  /** null = "run until manually stopped" — Meta receives no end time
   *  so winning ads keep delivering past an arbitrary duration. */
  endTimeIso: string | null;
  creative: {
    imageUrl: string;
    imageWidth?: number | null;
    imageHeight?: number | null;
    headline: string;
    primaryText: string;
    description?: string | null;
    ctaType: string;
    linkUrl: string;
    privacyPolicyUrl: string;
  };
  isFirstLaunch: boolean;
  goLive: boolean;
};

export type LaunchCampaignResult = {
  ok: true;
  campaignId: string;
  metaCampaignId: string;
  metaCampaignDbId: string;
  paused: boolean;
};

export function useLaunchMetaCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LaunchCampaignPayload): Promise<LaunchCampaignResult> => {
      const response = (await postJson(
        '/api/integrations/meta_ads/launch',
        payload,
      )) as unknown as LaunchCampaignResult;
      return response;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: ['campaigns', 'admin'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'client'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'sub-account'] });
    },
  });
}

/** Manual on-demand sync — enqueues the same jobs the cron does. */
export function useSyncMetaCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      metaCampaignDbId: string;
    }) => {
      await postJson('/api/integrations/meta_ads/sync', input);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: insightsKey(vars.clientId, 30) });
      qc.invalidateQueries({ queryKey: ['campaigns', 'admin'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'client'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'sub-account'] });
    },
  });
}
