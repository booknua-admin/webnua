// =============================================================================
// /api/integrations/meta_ads/sync
//
// Manual on-demand sync — client-or-operator. Same job handlers the cron
// enqueues; this route just forces an immediate refresh. A read-only
// action (pulls latest metrics + leads for the caller's own client), so
// allowing the client mirrors the GBP "Sync now" pattern.
//
// Two shapes:
//   POST { clientId }
//     Fires `meta_sync_campaigns` for the whole ad account — discovers
//     campaigns built in Ads Manager + writes / refreshes the matching
//     public.campaigns + meta_campaigns rows. The /campaigns roster
//     hook (`useAdminCampaigns` / `useClientCampaigns`) invalidates on
//     mount of the next render, so a fresh sync surfaces within seconds.
//
//   POST { clientId, metaCampaignDbId }
//     Per-campaign sync — enqueues `meta_sync_insights` (last 7 days)
//     + `meta_sync_leads` (last 24h) for one specific meta_campaigns row.
//     Used by the per-row "Sync now" affordance on /campaigns once
//     campaigns exist.
// =============================================================================

import { NextResponse } from 'next/server';

import { findMetaCampaignById } from '@/lib/integrations/meta-ads/campaigns';
import { findLeadFormById } from '@/lib/integrations/meta-ads/lead-forms';
import {
  META_SYNC_CAMPAIGNS_JOB,
  META_SYNC_INSIGHTS_JOB,
  META_SYNC_LEADS_JOB,
  type MetaSyncCampaignsPayload,
  type MetaSyncInsightsPayload,
  type MetaSyncLeadsPayload,
} from '@/lib/integrations/meta-ads/job-types';
import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';

export async function POST(request: Request): Promise<Response> {
  let body: { clientId?: unknown; metaCampaignDbId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }
  const clientId = body.clientId;
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return NextResponse.json({ error: 'missing-clientId' }, { status: 400 });
  }

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Whole-account sync — no metaCampaignDbId means "discover campaigns
  // built in Ads Manager + refresh local rows". This is what the
  // /campaigns surface "Sync campaigns" button calls.
  const metaCampaignDbId = body.metaCampaignDbId;
  if (typeof metaCampaignDbId !== 'string' || metaCampaignDbId.length === 0) {
    const payload: MetaSyncCampaignsPayload = { clientId };
    await enqueueJobImmediate(META_SYNC_CAMPAIGNS_JOB, payload, {
      clientId,
      provider: 'meta_ads',
      correlationId: clientId,
    });
    return NextResponse.json({ ok: true, kind: 'campaigns' });
  }

  // Per-campaign sync — insights + leads for one row.
  const local = await findMetaCampaignById(metaCampaignDbId);
  if (!local || local.client_id !== clientId) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  // Manual sync widens the date window — pull the last 7 days, not just
  // yesterday, so the operator gets visible motion even if the cron just
  // ran. The upsert dedupes per day.
  const today = new Date();
  const sinceDate = new Date(today);
  sinceDate.setDate(sinceDate.getDate() - 7);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const insightsPayload: MetaSyncInsightsPayload = {
    clientId,
    metaCampaignId: local.id,
    dateRange: { since: iso(sinceDate), until: iso(today) },
  };
  await enqueueJobImmediate(META_SYNC_INSIGHTS_JOB, insightsPayload, {
    clientId,
    provider: 'meta_ads',
    correlationId: local.id,
  });

  // Leads sync — only enqueue when a lead form is wired.
  if (local.meta_lead_form_id) {
    const leadForm = await findLeadFormById(local.meta_lead_form_id);
    if (leadForm) {
      const leadsPayload: MetaSyncLeadsPayload = {
        clientId,
        metaCampaignId: local.id,
        metaLeadFormId: leadForm.id,
        metaFormId: leadForm.meta_form_id,
        // Wider lookback on manual sync — 24h vs the cron's 1h.
        fromUnix: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
      };
      await enqueueJobImmediate(META_SYNC_LEADS_JOB, leadsPayload, {
        clientId,
        provider: 'meta_ads',
        correlationId: local.id,
      });
    }
  }

  return NextResponse.json({ ok: true, kind: 'campaign' });
}
