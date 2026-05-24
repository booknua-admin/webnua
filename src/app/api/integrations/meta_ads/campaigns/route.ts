// =============================================================================
// /api/integrations/meta_ads/campaigns
//
// Operator-only Meta-campaign lifecycle.
//
//   POST { clientId, action: 'launch', templateSlug, dailyBudgetMajor,
//          pageId, pageAccessToken, privacyPolicyUrl, linkUrl,
//          contextOverrides?, initialStatus?, startDate?, endDate? }
//     Runs the 5-step launch sequence (campaign → ad set → lead form →
//     creative → ad), inserts the operator-facing public.campaigns row
//     and the meta_campaigns linking row. Returns the new ids OR a
//     structured failure naming which step broke.
//
//   POST { clientId, action: 'pause' | 'activate', metaCampaignDbId }
//     Flip the campaign's status on Meta + update the local row.
//
// Returns 503 when Meta is unconfigured, 502 for downstream Meta errors,
// 400 for bad input.
// =============================================================================

import { NextResponse } from 'next/server';

import {
  activateCampaign,
  isMetaConfigured,
  pauseCampaign,
} from '@/lib/integrations/meta-ads/client';
import {
  findMetaCampaignById,
  updateMetaCampaignStatus,
} from '@/lib/integrations/meta-ads/campaigns';
import { launchCampaign } from '@/lib/integrations/meta-ads/campaign-launch';
import {
  getCampaignTemplate,
  isCampaignTemplateSlug,
} from '@/lib/integrations/meta-ads/campaign-templates';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

// 30-day window from a client's first campaign launch is the month-1
// ad-credit envelope. Earlier launches are tagged 'webnua_month_1'; later
// ones default to 'webnua_ongoing'. The Stripe subscription start date
// would be the cleaner anchor but is not always present (client may have
// no Stripe subscription); first-meta-campaign date is the next-best
// proxy.
const MONTH_ONE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

async function determineCreatedVia(
  clientId: string,
): Promise<'webnua_month_1' | 'webnua_ongoing'> {
  // Look up the client's stripe customer row for a subscription start
  // date; fall back to "no prior Meta campaigns" = month_1.
  const db = getIntegrationDb();
  const { data: stripe } = await db
    .from('client_stripe_customers')
    .select('current_period_end, last_payment_at, created_at')
    .eq('client_id', clientId)
    .maybeSingle();
  if (stripe) {
    const anchor =
      (stripe as { last_payment_at?: string | null }).last_payment_at ??
      (stripe as { created_at?: string | null }).created_at;
    if (typeof anchor === 'string') {
      const anchorMs = new Date(anchor).getTime();
      const ageMs = Date.now() - anchorMs;
      return ageMs <= MONTH_ONE_WINDOW_MS ? 'webnua_month_1' : 'webnua_ongoing';
    }
  }
  // No stripe data — go by whether they've launched a Meta campaign before.
  const { data: existing } = await db
    .from('meta_campaigns')
    .select('id, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (!existing || existing.length === 0) return 'webnua_month_1';
  return 'webnua_ongoing';
}

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown; action?: unknown; [k: string]: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireOperatorForClient(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: 'meta-not-configured' }, { status: 503 });
  }

  const action = body.action;
  if (action === 'launch') return handleLaunch(body, clientId);
  if (action === 'pause' || action === 'activate') {
    return handleStatusFlip(body, clientId, action);
  }
  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}

async function handleLaunch(
  body: Record<string, unknown>,
  clientId: string,
): Promise<Response> {
  const templateSlug = body.templateSlug;
  if (typeof templateSlug !== 'string' || !isCampaignTemplateSlug(templateSlug)) {
    return NextResponse.json({ error: 'invalid-templateSlug' }, { status: 400 });
  }
  const dailyBudgetMajor =
    typeof body.dailyBudgetMajor === 'number' ? body.dailyBudgetMajor : NaN;
  if (!Number.isFinite(dailyBudgetMajor) || dailyBudgetMajor <= 0) {
    return NextResponse.json({ error: 'invalid-dailyBudgetMajor' }, { status: 400 });
  }
  const pageId = body.pageId;
  const pageAccessToken = body.pageAccessToken;
  const privacyPolicyUrl = body.privacyPolicyUrl;
  const linkUrl = body.linkUrl;
  if (typeof pageId !== 'string' || pageId.length === 0) {
    return NextResponse.json({ error: 'missing-pageId' }, { status: 400 });
  }
  if (typeof pageAccessToken !== 'string' || pageAccessToken.length === 0) {
    return NextResponse.json({ error: 'missing-pageAccessToken' }, { status: 400 });
  }
  if (typeof privacyPolicyUrl !== 'string' || !privacyPolicyUrl.startsWith('http')) {
    return NextResponse.json({ error: 'invalid-privacyPolicyUrl' }, { status: 400 });
  }
  if (typeof linkUrl !== 'string' || !linkUrl.startsWith('http')) {
    return NextResponse.json({ error: 'invalid-linkUrl' }, { status: 400 });
  }

  const template = getCampaignTemplate(templateSlug);

  // Pull defaults from the client + brand for the context — the operator
  // can override anything via contextOverrides on the body.
  const db = getIntegrationDb();
  const { data: clientRow } = await db
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .maybeSingle();
  const { data: funnelRow } = await db
    .from('funnels')
    .select('funnel_service, funnel_guarantee')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1);
  const funnel = (funnelRow as Array<{
    funnel_service: string | null;
    funnel_guarantee: string | null;
  }> | null)?.[0];

  const overrides = (body.contextOverrides ?? {}) as Record<string, string>;
  const context = {
    businessName: overrides.businessName ?? (clientRow as { name?: string } | null)?.name,
    industry: overrides.industry,
    serviceArea: overrides.serviceArea,
    funnelService: overrides.funnelService ?? funnel?.funnel_service ?? undefined,
    funnelGuarantee: overrides.funnelGuarantee ?? funnel?.funnel_guarantee ?? undefined,
  };

  const createdVia = await determineCreatedVia(clientId);

  const result = await launchCampaign({
    clientId,
    template,
    context,
    dailyBudgetMajor,
    startDate: typeof body.startDate === 'string' ? body.startDate : undefined,
    endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
    pageId,
    pageAccessToken,
    privacyPolicyUrl,
    linkUrl,
    initialStatus:
      body.initialStatus === 'ACTIVE' || body.initialStatus === 'PAUSED'
        ? body.initialStatus
        : 'PAUSED',
    createdVia,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: 'launch-failed',
        step: result.step,
        detail: result.message,
        partial: result.partial,
      },
      { status: result.step === 'pre-flight' ? 400 : 502 },
    );
  }
  return NextResponse.json(result);
}

async function handleStatusFlip(
  body: Record<string, unknown>,
  clientId: string,
  action: 'pause' | 'activate',
): Promise<Response> {
  const metaCampaignDbId = body.metaCampaignDbId;
  if (typeof metaCampaignDbId !== 'string' || metaCampaignDbId.length === 0) {
    return NextResponse.json({ error: 'missing-metaCampaignDbId' }, { status: 400 });
  }
  const local = await findMetaCampaignById(metaCampaignDbId);
  if (!local || local.client_id !== clientId) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const op =
    action === 'pause'
      ? pauseCampaign(clientId, local.meta_campaign_id)
      : activateCampaign(clientId, local.meta_campaign_id);
  const result = await op;
  if (!result.ok) {
    return NextResponse.json(
      {
        error: 'status-flip-failed',
        detail: result.error.message,
        class: result.error.class,
      },
      { status: 502 },
    );
  }
  await updateMetaCampaignStatus(
    local.id,
    action === 'pause' ? 'paused' : 'active',
  );
  // Also flip the operator-facing public.campaigns row.
  const db = getIntegrationDb();
  await db
    .from('campaigns')
    .update({ status: action === 'pause' ? 'paused' : 'active' } as unknown as never)
    .eq('id', local.campaign_id);
  return NextResponse.json({ ok: true });
}
