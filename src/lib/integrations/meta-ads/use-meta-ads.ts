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
      const response = await fetch('/api/integrations/meta_ads/ad-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', clientId: input.clientId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed to list ad accounts (${response.status}).`);
      }
      const body = (await response.json()) as AdAccountPickerResponse;
      return body;
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
      const response = await fetch('/api/integrations/meta_ads/ad-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', ...input }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed to save ad account (${response.status}).`);
      }
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
      const response = await fetch('/api/integrations/meta_ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch', ...input }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Launch failed (${response.status}).`);
      }
      return response.json();
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: insightsKey(vars.clientId, 30) });
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
      const response = await fetch('/api/integrations/meta_ads/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: input.status === 'ACTIVE' ? 'activate' : 'pause',
          clientId: input.clientId,
          metaCampaignDbId: input.metaCampaignDbId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Status change failed (${response.status}).`);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
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
      const response = await fetch('/api/integrations/meta_ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? `Sync failed (${response.status}).`);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: campaignsKey(vars.clientId) });
      qc.invalidateQueries({ queryKey: insightsKey(vars.clientId, 30) });
    },
  });
}
