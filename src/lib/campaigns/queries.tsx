// =============================================================================
// Campaigns cluster — data access (Phase 3 · partial wire + Phase 7 Meta).
//
// The `campaigns` table stores the operator-facing record (name, status,
// budget, dates, external_ref). The Phase 7 Meta Ads session added the
// `meta_campaigns` + `meta_ads_insights` companion tables — when a row
// in `campaigns` has a matching `meta_campaigns` row, this module joins
// to it + sums the last 7 days of insights to replace the previously-
// placeholder leads / spend / CPL values with real numbers. Campaigns
// with no Meta linkage (legacy / Phase 5 stubs / future non-Meta
// surfaces) continue to render the honest "Awaiting Meta Ads"
// placeholders.
//
// The 4-week trend chart on the client deep-dive (`CampaignTrendChart`)
// reads from `meta_ads_insights` for the linked campaign; the per-row
// sparklines on the admin roster read the last 14 days.
//
// RLS bounds the rows; the same fetch serves both roles.
// =============================================================================

import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { relativeTime } from '@/lib/time';

import type {
  AdminCampaignRow,
  AdminCampaignsPage,
  AdminCampaignStatus,
  CampaignActivityIconTone,
  CampaignActivityItem,
  CampaignHeroData,
  CampaignMetric,
  CampaignTrendChartData,
  ClientCampaignsPage,
} from './types';

// ---- Row shapes -------------------------------------------------------------

type ActivityEventRow = {
  id: string;
  category: string;
  occurred_at: string;
  payload: unknown;
  actor: { display_name: string } | null;
};

type CampaignRow = {
  id: string;
  client_id: string;
  name: string;
  status: string;
  budget: number | null;
  starts_at: string | null;
  ends_at: string | null;
  client: { name: string; slug: string } | null;
  campaign_activity_events: ActivityEventRow[];
};

type ClientRow = { id: string; name: string; slug: string };

const CAMPAIGN_SELECT =
  'id, client_id, name, status, budget, starts_at, ends_at, ' +
  'client:clients(name, slug), ' +
  'campaign_activity_events(id, category, occurred_at, payload, ' +
  'actor:users(display_name))';

// ---- Helpers ----------------------------------------------------------------

// ---- Meta-side metric stitching --------------------------------------------
//
// The four Meta tables (client_meta_ad_accounts / meta_campaigns /
// meta_ads_insights / meta_lead_forms) aren't in the generated Database
// type yet — same situation as the Phase 7 integration tables. Read them
// through an untyped view of the supabase client (cast through
// `unknown`), same pattern as use-gbp.ts. RLS still gates the rows.

import type { SupabaseClient } from '@supabase/supabase-js';
function untypedSupabase(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}
//
// Each entry resolves a campaign id (public.campaigns.id) to the rolled-up
// last-7-day metrics + the last-14-day per-day sparkline points. Empty
// map = no Meta linkage exists for any campaign yet, every row falls back
// to the placeholder shape.

type MetaMetrics = {
  leads: number;
  spendCents: number;
  cplCents: number | null;
  sparkPoints: number[];           // 14 points, oldest → newest (lead counts)
};

const METRICS_WINDOW_DAYS = 7;
const SPARK_WINDOW_DAYS = 14;

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'PGRST205';
}

/** Fetch Meta-side metrics for a batch of public.campaigns ids. Returns a
 *  Map keyed on `campaigns.id`. Degrades to an empty map if the Meta
 *  tables aren't deployed yet. */
async function fetchMetaMetricsByCampaignId(
  campaignIds: string[],
): Promise<Map<string, MetaMetrics>> {
  const map = new Map<string, MetaMetrics>();
  if (campaignIds.length === 0) return map;
  const ud = untypedSupabase();
  // Step 1 — resolve the public.campaigns ids to meta_campaigns rows.
  const { data: metaRows, error: metaErr } = await ud
    .from('meta_campaigns')
    .select('id, campaign_id')
    .in('campaign_id', campaignIds);
  if (metaErr) {
    // Missing table = Meta migrations not yet applied; degrade silently.
    if (isMissingTableError(metaErr)) return map;
    throw normalizeError(metaErr);
  }
  const meta = (metaRows ?? []) as Array<{ id: string; campaign_id: string }>;
  if (meta.length === 0) return map;
  const metaIds = meta.map((m) => m.id);
  const sparkSince = new Date(Date.now() - SPARK_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // Step 2 — pull the last 14 days of insights for those campaigns in one
  // round-trip. The 7-day metric window is a subset of the 14-day spark
  // window so we don't make two queries.
  const { data: insightsRows, error: insightsErr } = await ud
    .from('meta_ads_insights')
    .select('meta_campaign_id, date_recorded, leads, spend_cents')
    .in('meta_campaign_id', metaIds)
    .gte('date_recorded', sparkSince)
    .order('date_recorded', { ascending: true });
  if (insightsErr) {
    if (isMissingTableError(insightsErr)) return map;
    throw normalizeError(insightsErr);
  }
  const insights = (insightsRows ?? []) as Array<{
    meta_campaign_id: string;
    date_recorded: string;
    leads: number;
    spend_cents: number;
  }>;
  // Bucket by meta_campaigns.id.
  const byMeta = new Map<string, typeof insights>();
  for (const r of insights) {
    const existing = byMeta.get(r.meta_campaign_id);
    if (existing) existing.push(r);
    else byMeta.set(r.meta_campaign_id, [r]);
  }
  const metricSince = new Date(Date.now() - METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  for (const m of meta) {
    const rows = byMeta.get(m.id) ?? [];
    let leads = 0;
    let spendCents = 0;
    const sparkPoints: number[] = [];
    for (const r of rows) {
      sparkPoints.push(r.leads ?? 0);
      // Only sum into the 7-day metric window.
      if (r.date_recorded >= metricSince) {
        leads += r.leads ?? 0;
        spendCents += r.spend_cents ?? 0;
      }
    }
    map.set(m.campaign_id, {
      leads,
      spendCents,
      cplCents: leads > 0 ? Math.round(spendCents / leads) : null,
      sparkPoints,
    });
  }
  return map;
}

function formatCents(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Convert a series of values (oldest → newest) into an SVG polyline
 *  points string sized to CampaignSparkline's 100×40 viewBox. Top of the
 *  chart = highest value; the curve uses 6px top + bottom padding so
 *  flat-zero series don't sit on the rule. */
function pointsForSparkline(values: number[]): string | undefined {
  if (values.length === 0) return undefined;
  const max = Math.max(...values);
  const w = 100;
  const h = 40;
  const padTop = 6;
  const padBottom = 6;
  const innerH = h - padTop - padBottom;
  const denom = values.length > 1 ? values.length - 1 : 1;
  return values
    .map((v, i) => {
      const x = (i / denom) * w;
      const y = max > 0 ? padTop + (1 - v / max) * innerH : h - padBottom;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function payloadObject(payload: unknown): Record<string, unknown> {
  return payload !== null && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : {};
}

function formatBudget(budget: number | null): string {
  if (budget == null) return 'No budget set';
  return `$${Math.round(budget).toLocaleString('en-AU')}`;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  pending: 'Pending · not yet launched',
};

function toCampaignStatus(status: string): AdminCampaignStatus {
  return status === 'active' || status === 'paused' ? status : 'pending';
}

const ACTIVITY_ICON: Record<CampaignActivityIconTone, string> = {
  creative: '✦',
  audience: '◎',
  budget: '$',
  tune: '⚙',
};

function toActivityTone(category: string): CampaignActivityIconTone {
  return category === 'creative' ||
    category === 'audience' ||
    category === 'budget' ||
    category === 'tune'
    ? category
    : 'tune';
}

function mapActivityEvent(event: ActivityEventRow): CampaignActivityItem {
  const tone = toActivityTone(event.category);
  const payload = payloadObject(event.payload);
  const summary =
    typeof payload.summary === 'string'
      ? payload.summary
      : `${event.category} change`;

  let desc = '';
  if (
    tone === 'budget' &&
    typeof payload.from === 'number' &&
    typeof payload.to === 'number'
  ) {
    desc = `From $${payload.from} to $${payload.to}`;
  }

  return {
    id: event.id,
    icon: ACTIVITY_ICON[tone],
    tone,
    who: event.actor?.display_name ?? 'Webnua',
    body: summary,
    desc,
    time: `${relativeTime(event.occurred_at)} ago`,
  };
}

// The metric tiles + trend are integration-blocked — see the module header.
const PLACEHOLDER_METRICS: CampaignMetric[] = [
  { label: '// LEADS', value: '—', trend: 'Awaiting Meta Ads', trendTone: 'quiet' },
  {
    label: '// COST / LEAD',
    value: '—',
    trend: 'Awaiting Meta Ads',
    trendTone: 'quiet',
  },
  { label: '// SPEND', value: '—', trend: 'Awaiting Meta Ads', trendTone: 'quiet' },
  {
    label: '// CONVERSION',
    value: '—',
    trend: 'Awaiting Meta Ads',
    trendTone: 'quiet',
  },
];

const PLACEHOLDER_PLAIN_ENGLISH: ReactNode = (
  <>
    Performance data — leads, cost per lead, spend — appears here once this
    client&apos;s <strong>Meta ad account is connected</strong>. The campaign
    record and the change log below are live now.
  </>
);

// =============================================================================
// Client `/campaigns` — the signed-in client's campaign deep-dive.
// =============================================================================

async function fetchClientCampaigns(): Promise<ClientCampaignsPage | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const [clientResult, campaignsResult] = await Promise.all([
    supabase.from('clients').select('id, name, slug'),
    supabase
      .from('campaigns')
      .select(CAMPAIGN_SELECT)
      .order('created_at', { ascending: false }),
  ]);

  if (clientResult.error) throw normalizeError(clientResult.error);
  if (campaignsResult.error) throw normalizeError(campaignsResult.error);

  const client = (clientResult.data as ClientRow[])[0];
  const campaigns = campaignsResult.data as unknown as CampaignRow[];
  const clientName = client?.name ?? 'Your business';

  // The deep-dive shows one campaign — the running one, else the most recent.
  const campaign =
    campaigns.find((c) => c.status === 'active') ?? campaigns[0] ?? null;

  const hero = {
    eyebrow: `// ${clientName} · Meta ads · managed by Webnua`,
    title: (
      <>
        Your <em>campaigns</em>.
      </>
    ),
    subtitle: (
      <>
        What Webnua is running on your behalf.{' '}
        <strong>This page is read-only</strong> — want a change? Text Craig.
      </>
    ),
  };

  const managedBand = {
    icon: '⚙',
    tag: '// MANAGED BY WEBNUA',
    title: (
      <>
        Webnua handles your <em>ad strategy + creative</em>
      </>
    ),
    sub: (
      <>
        Targeting, creative, budgets, A/B tests —{' '}
        <strong>all of it sits on the Webnua side</strong>. This page exists so
        you always know what&apos;s running and what it&apos;s returning.
      </>
    ),
    cta: { label: '☏ Text Craig', href: '#' },
  };

  const changeCard = {
    body: (
      <>
        Want to test a new offer, pause for a holiday, or change the budget?{' '}
        <strong>Webnua makes every campaign change for you.</strong>
      </>
    ),
    actions: [
      { label: 'Text Craig', primary: true },
      { label: 'Open a ticket' },
    ],
  };

  if (!campaign) {
    // No campaign yet — an honest empty deep-dive.
    return {
      hero,
      managedBand,
      active: {
        eyebrow: '// NO CAMPAIGN YET',
        name: <>No active campaign</>,
        meta: <>Webnua launches your first campaign once your funnel is live.</>,
        statusLabel: 'Not launched',
        metrics: PLACEHOLDER_METRICS,
        plainEnglish: PLACEHOLDER_PLAIN_ENGLISH,
      },
      activity: {
        title: <>{'// Recent activity'}</>,
        sub: <>Changes Webnua has made.</>,
        items: [],
      },
      changeCard,
    };
  }

  // Phase 7 Meta — try to fill in real metrics + trend for this campaign.
  const metaMetricsMap = await fetchMetaMetricsByCampaignId([campaign.id]);
  const metaMetrics = metaMetricsMap.get(campaign.id);
  const trend = await fetchMetaWeeklyTrend(campaign.id);

  const active: CampaignHeroData = {
    eyebrow: `// ${(STATUS_LABEL[campaign.status] ?? campaign.status).toUpperCase()}`,
    name: <>{campaign.name}</>,
    meta: (
      <>
        Budget <strong>{formatBudget(campaign.budget)}</strong> ·{' '}
        {STATUS_LABEL[campaign.status] ?? campaign.status}
      </>
    ),
    statusLabel: STATUS_LABEL[campaign.status] ?? campaign.status,
    metrics: metaMetrics ? buildLiveMetrics(metaMetrics) : PLACEHOLDER_METRICS,
    plainEnglish: metaMetrics ? buildLivePlainEnglish(metaMetrics) : PLACEHOLDER_PLAIN_ENGLISH,
  };

  const events = [...campaign.campaign_activity_events].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );

  return {
    hero,
    managedBand,
    active,
    ...(trend ? { trend } : {}),
    activity: {
      title: <>{"// What Webnua's done lately"}</>,
      sub: <>Every change to this campaign, newest first.</>,
      items: events.map(mapActivityEvent),
    },
    changeCard,
  };
}

// ---- Live-metrics builders + 4-week trend ----------------------------------

function buildLiveMetrics(m: MetaMetrics): CampaignMetric[] {
  return [
    {
      label: '// LEADS · 7D',
      value: String(m.leads),
      trend: 'Last 7 days · Meta',
      trendTone: 'good',
    },
    {
      label: '// COST / LEAD',
      value: m.cplCents != null ? formatCents(m.cplCents) : '—',
      trend: m.cplCents != null ? 'Live · last 7 days' : 'No leads yet',
      trendTone: 'quiet',
    },
    {
      label: '// SPEND · 7D',
      value: formatCents(m.spendCents),
      trend: 'Last 7 days · Meta',
      trendTone: 'quiet',
    },
    {
      label: '// CONVERSION',
      value: '—',
      trend: 'GA4 integration pending',
      trendTone: 'quiet',
    },
  ];
}

function buildLivePlainEnglish(m: MetaMetrics): ReactNode {
  if (m.leads === 0) {
    return (
      <>
        Campaign is live but <strong>no leads yet</strong> in the last 7 days.
        Give it 48 hours after launch before drawing conclusions — Meta takes
        time to find the right audience.
      </>
    );
  }
  const cpl = m.cplCents != null ? formatCents(m.cplCents) : '—';
  return (
    <>
      <strong>{m.leads} leads</strong> in the last 7 days at{' '}
      <strong>{cpl} per lead</strong>. Spend ran at{' '}
      <strong>{formatCents(m.spendCents)}</strong> across the week.
    </>
  );
}

/** Build the 4-week leads / spend trend for the client deep-dive. Returns
 *  null when no Meta data exists for this campaign yet (the consuming
 *  page renders a placeholder card). */
async function fetchMetaWeeklyTrend(
  campaignId: string,
): Promise<CampaignTrendChartData | null> {
  // Resolve campaign → meta_campaign row first.
  const ud = untypedSupabase();
  const { data: metaRows, error: metaErr } = await ud
    .from('meta_campaigns')
    .select('id')
    .eq('campaign_id', campaignId)
    .maybeSingle();
  if (metaErr) {
    if (isMissingTableError(metaErr)) return null;
    throw normalizeError(metaErr);
  }
  const meta = metaRows as { id: string } | null;
  if (!meta) return null;
  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: insightsRows, error: insightsErr } = await ud
    .from('meta_ads_insights')
    .select('date_recorded, leads, spend_cents')
    .eq('meta_campaign_id', meta.id)
    .gte('date_recorded', since)
    .order('date_recorded', { ascending: true });
  if (insightsErr) {
    if (isMissingTableError(insightsErr)) return null;
    throw normalizeError(insightsErr);
  }
  const rows = (insightsRows ?? []) as Array<{
    date_recorded: string;
    leads: number;
    spend_cents: number;
  }>;
  if (rows.length === 0) return null;
  // Bucket into 4 weeks (oldest → newest).
  const weekBuckets = [0, 1, 2, 3].map((i) => {
    const start = new Date(Date.now() - (28 - i * 7) * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - (28 - (i + 1) * 7) * 24 * 60 * 60 * 1000);
    return {
      startIso: start.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
      label: i === 3 ? 'This week' : i === 2 ? 'Last week' : `${3 - i + 1}w ago`,
      leads: 0,
      spendCents: 0,
    };
  });
  for (const r of rows) {
    const bucket = weekBuckets.find(
      (b) => r.date_recorded >= b.startIso && r.date_recorded < b.endIso,
    );
    if (bucket) {
      bucket.leads += r.leads ?? 0;
      bucket.spendCents += r.spend_cents ?? 0;
    }
  }
  const leadsMax = Math.max(1, ...weekBuckets.map((w) => w.leads));
  const spendMax = Math.max(1, ...weekBuckets.map((w) => w.spendCents));
  return {
    title: (
      <>
        Last 4 <em>weeks</em>
      </>
    ),
    sub: 'Leads versus ad spend',
    yAxisLabels: [String(leadsMax), String(Math.round(leadsMax / 2)), '0'],
    leadsMax,
    spendMax,
    weeks: weekBuckets.map((w, i) => ({
      label: w.label,
      leads: w.leads,
      spend: w.spendCents,
      current: i === 3,
    })),
    legendLeadsLabel: 'Leads',
    legendSpendLabel: 'Spend',
  };
}

/** The client campaigns page — RLS bounds rows to the signed-in client. */
export function useClientCampaigns() {
  return useQuery({
    queryKey: ['campaigns', 'client'],
    queryFn: fetchClientCampaigns,
  });
}

// =============================================================================
// Admin `/campaigns` — the cross-client campaign roster.
// =============================================================================

async function fetchAdminCampaigns(): Promise<AdminCampaignsPage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const { data, error } = await supabase
    .from('campaigns')
    .select(CAMPAIGN_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);

  const campaigns = data as unknown as CampaignRow[];

  // Phase 7 Meta — pull the linked Meta-side metrics so per-row leads /
  // spend / CPL show real numbers instead of dashes.
  const metaMetrics = await fetchMetaMetricsByCampaignId(campaigns.map((c) => c.id));

  const rows: AdminCampaignRow[] = campaigns.map((c) => {
    const status = toCampaignStatus(c.status);
    const clientName = c.client?.name ?? 'Unknown client';
    const metrics = metaMetrics.get(c.id);
    return {
      id: c.id,
      clientId: c.client?.slug ?? 'generic',
      logoInitial: (clientName[0] ?? '?').toUpperCase(),
      name: `${clientName} · ${c.name}`,
      meta: (
        <>
          Budget <strong>{formatBudget(c.budget)}</strong> ·{' '}
          {STATUS_LABEL[c.status] ?? c.status}
        </>
      ),
      status,
      cells: [
        {
          value: metrics ? String(metrics.leads) : '—',
          sub: 'LEADS · 7D',
        },
        {
          value: metrics ? formatCents(metrics.spendCents) : '—',
          sub: 'SPEND · 7D',
        },
        {
          value:
            metrics && metrics.cplCents != null
              ? formatCents(metrics.cplCents)
              : '—',
          sub: 'CPL',
        },
      ],
      // 14-day per-day lead counts when present, encoded as the
      // sparkline's points string; omitted → dashed flatline.
      sparkPoints:
        metrics && metrics.sparkPoints.length > 0
          ? pointsForSparkline(metrics.sparkPoints)
          : undefined,
      dimmed: status === 'pending',
    };
  });

  // Workspace-stat for total leads-7d — sum across all campaigns that
  // surfaced Meta metrics (a workspace with no Meta data yet still shows
  // '—').
  let workspaceLeads7d = 0;
  let anyMetrics = false;
  for (const m of metaMetrics.values()) {
    workspaceLeads7d += m.leads;
    anyMetrics = true;
  }

  // Client filter chips, derived from the campaigns' own clients.
  const clients = new Map<string, string>();
  for (const c of campaigns) {
    if (c.client) clients.set(c.client.slug, c.client.name);
  }
  const filters = [
    { id: 'all', label: 'All clients' },
    ...[...clients].map(([slug, name]) => ({ id: slug, label: name })),
  ];

  const activeCount = campaigns.filter((c) => c.status === 'active').length;
  const pendingCount = campaigns.filter((c) => c.status === 'pending').length;
  const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget ?? 0), 0);

  return {
    hero: {
      eyebrow: '// Workspace · campaigns',
      title: (
        <>
          All <em>campaigns</em>.
        </>
      ),
      subtitle: (
        <>
          Every Meta ad campaign across the workspace.{' '}
          <strong>
            Live performance metrics sync once each client&apos;s Meta ad
            account is connected.
          </strong>
        </>
      ),
    },
    filters,
    defaultFilterId: 'all',
    stats: [
      {
        label: '// ACTIVE',
        value: String(activeCount),
        trend: `of ${campaigns.length} total`,
        trendTone: 'quiet',
      },
      {
        label: '// PENDING',
        value: String(pendingCount),
        trend: 'awaiting launch',
        trendTone: 'quiet',
      },
      {
        label: '// TOTAL BUDGET',
        value: formatBudget(totalBudget),
        trend: 'across all campaigns',
        trendTone: 'quiet',
      },
      {
        label: '// LEADS · 7D',
        value: anyMetrics ? String(workspaceLeads7d) : '—',
        trend: anyMetrics ? 'from Meta lead-forms' : 'Awaiting Meta Ads',
        trendTone: 'quiet',
      },
    ],
    rows,
    footer: {
      tag: '// META ADS',
      body: 'Live performance metrics sync once each client’s Meta ad account is connected.',
      ctaLabel: 'Meta Ads setup →',
      ctaHref: '/settings/integrations',
    },
  };
}

/** The operator cross-client campaign roster — RLS bounds rows to the
 *  operator's accessible clients. */
export function useAdminCampaigns() {
  return useQuery({
    queryKey: ['campaigns', 'admin'],
    queryFn: fetchAdminCampaigns,
  });
}
