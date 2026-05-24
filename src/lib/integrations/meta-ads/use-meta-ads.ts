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

import type {
  ClientMetaAdAccountRow,
  MetaAdsInsightsRow,
  MetaCampaignRow,
} from './types';

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

async function fetchCampaigns(clientId: string): Promise<MetaCampaignRow[]> {
  const { data, error } = await db()
    .from('meta_campaigns')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error && !isMissingTableError(error)) throw normalizeError(error);
  return (data as MetaCampaignRow[] | null) ?? [];
}

export function useClientMetaCampaigns(clientId: string | null) {
  return useQuery({
    queryKey: campaignsKey(clientId),
    queryFn: () => fetchCampaigns(clientId as string),
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

/** Pick the ad account to wire to this client. Stores the selection. */
export function useSelectMetaAdAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      adAccountId: string;
      customerAgreementEmail: string;
    }) => {
      await postJson('/api/integrations/meta_ads/ad-accounts', {
        action: 'select',
        ...input,
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: adAccountKey(vars.clientId) });
    },
  });
}

/** Launch a campaign from a template. */
export function useLaunchMetaCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      templateSlug: string;
      dailyBudgetMajor: number;
      pageId: string;
      pageAccessToken: string;
      privacyPolicyUrl: string;
      linkUrl: string;
      contextOverrides?: Record<string, string>;
      initialStatus?: 'ACTIVE' | 'PAUSED';
      startDate?: string;
      endDate?: string;
    }) => {
      return await postJson('/api/integrations/meta_ads/campaigns', {
        action: 'launch',
        ...input,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: insightsKey(vars.clientId, 30) });
      // The /campaigns admin roster + client deep-dive read public.campaigns
      // (joined to meta_campaigns) — different query keys than the per-client
      // Meta hooks above. Without these invalidations a freshly-launched
      // campaign doesn't appear on /campaigns until a full refresh.
      qc.invalidateQueries({ queryKey: ['campaigns', 'admin'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'client'] });
    },
  });
}

/** Pause / resume a Meta campaign. */
export function useSetMetaCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      metaCampaignDbId: string;
      status: 'ACTIVE' | 'PAUSED';
    }) => {
      await postJson('/api/integrations/meta_ads/campaigns', {
        action: input.status === 'ACTIVE' ? 'activate' : 'pause',
        clientId: input.clientId,
        metaCampaignDbId: input.metaCampaignDbId,
      });
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: ['campaigns', 'admin'] });
      qc.invalidateQueries({ queryKey: ['campaigns', 'client'] });
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
    },
  });
}
