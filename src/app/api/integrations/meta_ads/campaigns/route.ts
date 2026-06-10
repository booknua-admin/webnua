// =============================================================================
// /api/integrations/meta_ads/campaigns
//
// Operator-only Meta-campaign status flips. Phase 7 Meta Ads · V1 model:
// campaigns are CREATED in Meta Ads Manager (Webnua has business-manager
// access via the customer's OAuth grant); Webnua only flips the status
// in-app so the operator can pause/resume from /campaigns without leaving
// Webnua.
//
//   POST { clientId, action: 'pause' | 'activate', metaCampaignDbId }
//     Flip the campaign's status on Meta + update the local row.
//
// The previous `launch` action (in-app campaign builder) was removed when
// the V1 design settled on managing campaigns directly in Ads Manager;
// the `LaunchMetaCampaignButton` now deep-links to Meta's UI.
//
// Returns 503 when Meta is unconfigured, 502 for downstream Meta errors,
// 400 for bad input.
// =============================================================================

import { NextResponse } from 'next/server';

import {
  activateCampaign,
  isMetaConfigured,
  pauseCampaign,
  updateCampaignDailyBudget,
} from '@/lib/integrations/meta-ads/client';
import {
  findMetaCampaignById,
  updateMetaCampaignStatus,
} from '@/lib/integrations/meta-ads/campaigns';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';

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
  if (action === 'pause' || action === 'activate') {
    return handleStatusFlip(body, clientId, action);
  }
  if (action === 'set_budget') {
    return handleSetBudget(body, clientId);
  }
  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}

/** set_budget — update a campaign's daily budget on Meta + the local rows.
 *  The ads-autopilot approve dispatcher is the main caller. */
async function handleSetBudget(
  body: Record<string, unknown>,
  clientId: string,
): Promise<Response> {
  const metaCampaignDbId = body.metaCampaignDbId;
  if (typeof metaCampaignDbId !== 'string' || metaCampaignDbId.length === 0) {
    return NextResponse.json({ error: 'missing-metaCampaignDbId' }, { status: 400 });
  }
  const dailyBudgetCents = body.dailyBudgetCents;
  if (
    typeof dailyBudgetCents !== 'number' ||
    !Number.isFinite(dailyBudgetCents) ||
    dailyBudgetCents < 100
  ) {
    return NextResponse.json({ error: 'invalid-dailyBudgetCents' }, { status: 400 });
  }
  const local = await findMetaCampaignById(metaCampaignDbId);
  if (!local || local.client_id !== clientId) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const result = await updateCampaignDailyBudget(
    clientId,
    local.meta_campaign_id,
    dailyBudgetCents,
  );
  if (!result.ok) {
    return NextResponse.json(
      {
        error: 'budget-update-failed',
        detail: result.error.message,
        class: result.error.class,
      },
      { status: 502 },
    );
  }
  const db = getIntegrationDb();
  await db
    .from('meta_campaigns')
    .update({ daily_budget_cents: Math.round(dailyBudgetCents) } as unknown as never)
    .eq('id', local.id);
  return NextResponse.json({ ok: true, dailyBudgetCents: Math.round(dailyBudgetCents) });
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
