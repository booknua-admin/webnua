// =============================================================================
// Campaigns cluster — data access (Phase 3 · partial wire).
//
// SCHEMA GAP — read this before extending. The `campaigns` table stores only
// the campaign *record* (name, status, budget, dates, external_ref), and
// `campaign_activity_events` stores the operator activity log. There are NO
// performance-metric columns and no `campaign_metrics` table: leads, spend,
// cost-per-lead, ROAS, the 4-week trend and the row sparklines are Meta Ads
// integration data, not yet modelled (design §5 #7 — the sparkline is "not
// stored at all"). So this module wires what the schema honestly has — the
// record + the activity log — and renders every metric as an honest
// "Awaiting Meta Ads" placeholder. When the integration lands, replace the
// placeholders with the real metric series; the record + activity wiring
// stays.
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
    metrics: PLACEHOLDER_METRICS,
    plainEnglish: PLACEHOLDER_PLAIN_ENGLISH,
  };

  const events = [...campaign.campaign_activity_events].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );

  return {
    hero,
    managedBand,
    active,
    // `trend` deliberately omitted — see the module header (Meta Ads gap).
    activity: {
      title: <>{"// What Webnua's done lately"}</>,
      sub: <>Every change to this campaign, newest first.</>,
      items: events.map(mapActivityEvent),
    },
    changeCard,
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

  const rows: AdminCampaignRow[] = campaigns.map((c) => {
    const status = toCampaignStatus(c.status);
    const clientName = c.client?.name ?? 'Unknown client';
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
      // Metric cells are integration-blocked — see the module header.
      cells: [
        { value: '—', sub: 'LEADS' },
        { value: '—', sub: 'SPEND' },
        { value: '—', sub: 'CPL' },
      ],
      // `sparkPoints` omitted → the row renders a dashed flatline.
      dimmed: status === 'pending',
    };
  });

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
        value: '—',
        trend: 'Awaiting Meta Ads',
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
