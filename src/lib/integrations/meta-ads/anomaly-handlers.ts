// =============================================================================
// Meta Ads — anomaly detection (SERVER-ONLY).
//
// Ads autopilot. The daily 06:30 UTC cron (migration 0120) enqueues
// `meta_detect_anomalies` per client with a wired ad account; the handler
// compares each campaign's recent window against its own baseline and keeps
// `meta_campaign_flags` current (one open flag per campaign+type; flags
// whose condition cleared resolve). Each open flag fans a plain-English
// `suggested_actions` card — pause, budget change, or acknowledge — that the
// operator approves from the action feed. Nothing is ever applied without
// approval.
//
// Windows: baseline = days -10..-4 (7 days), recent = last 3 days. All
// reads come from meta_ads_insights (the 04:00 sync fills yesterday).
// =============================================================================

import { createSuggestedAction } from '@/lib/actions/server';
import { getIntegrationDb } from '@/lib/integrations/_shared/db-types';
import { registerJobHandler } from '@/lib/integrations/_shared/jobs';

import type { MetaAdsInsightsRow, MetaCampaignRow } from './types';

export const META_DETECT_ANOMALIES_JOB = 'meta_detect_anomalies';

type FlagType =
  | 'cpl_spike'
  | 'lead_drought'
  | 'spend_not_pacing'
  | 'meta_issue'
  | 'performing_well';

type WindowStats = {
  spendCents: number;
  leads: number;
  impressions: number;
  days: number;
  /** Average CPL across the window, or null when no leads. */
  cplCents: number | null;
};

const eur = (cents: number): string => `€${(cents / 100).toFixed(2)}`;

function statsFor(rows: MetaAdsInsightsRow[]): WindowStats {
  const spendCents = rows.reduce((sum, r) => sum + (r.spend_cents ?? 0), 0);
  const leads = rows.reduce((sum, r) => sum + (r.leads ?? 0), 0);
  const impressions = rows.reduce((sum, r) => sum + (r.impressions ?? 0), 0);
  return {
    spendCents,
    leads,
    impressions,
    days: rows.length,
    cplCents: leads > 0 ? Math.round(spendCents / leads) : null,
  };
}

type Detection = {
  flagType: FlagType;
  metrics: Record<string, unknown>;
  /** The suggested_actions card the flag fans, or null for flag-only. */
  action: {
    kind: 'ads_pause' | 'ads_budget' | 'ads_creative_refresh' | 'generic';
    title: string;
    body: string;
    explanation: string;
    payload: Record<string, unknown>;
    urgency: 'normal' | 'high';
  } | null;
};

/** The rule engine — pure over one campaign's windows. */
function detect(
  campaign: MetaCampaignRow,
  baseline: WindowStats,
  recent: WindowStats,
): Detection[] {
  const detections: Detection[] = [];
  const name = campaign.campaign_name;
  const budget = campaign.daily_budget_cents;
  const basePayload = {
    metaCampaignDbId: campaign.id,
    campaignName: name,
    currentDailyBudgetCents: budget,
  };

  // Meta-side issue (disapproval, payment problem, …) — surfaced from the
  // status the insights sync refreshes.
  if (campaign.status === 'with_issues') {
    detections.push({
      flagType: 'meta_issue',
      metrics: { status: campaign.status },
      action: {
        kind: 'generic',
        title: `"${name}" has an issue on Meta`,
        body: `Meta has flagged this campaign (disapproved ad, payment problem, or policy review). Open Meta Ads Manager to see the exact issue — ads aren't delivering until it's fixed.`,
        explanation: 'Detected: Meta-side issue — campaign not delivering',
        payload: basePayload,
        urgency: 'high',
      },
    });
  }

  // Lead drought — meaningful spend over the recent window, zero leads.
  if (recent.spendCents >= 1_000 && recent.leads === 0 && recent.days >= 3) {
    detections.push({
      flagType: 'lead_drought',
      metrics: { recentSpendCents: recent.spendCents, recentLeads: 0, windowDays: recent.days },
      action: {
        kind: 'ads_pause',
        title: `"${name}" spent ${eur(recent.spendCents)} with no leads`,
        body: `This campaign spent ${eur(recent.spendCents)} over the last ${recent.days} days without a single lead. I'd pause it while you review the offer and creative — approving will pause it on Meta right away.`,
        explanation: 'Detected: lead drought — spend with zero leads',
        payload: basePayload,
        urgency: 'high',
      },
    });
  }

  // CPL spike vs the campaign's own baseline.
  if (
    baseline.leads >= 3 &&
    baseline.cplCents !== null &&
    recent.leads >= 1 &&
    recent.cplCents !== null &&
    recent.cplCents >= baseline.cplCents * 1.5
  ) {
    const pctUp = Math.round((recent.cplCents / baseline.cplCents - 1) * 100);
    const cut = budget ? Math.max(100, Math.round(budget * 0.7)) : null;
    detections.push({
      flagType: 'cpl_spike',
      metrics: {
        baselineCplCents: baseline.cplCents,
        recentCplCents: recent.cplCents,
        pctUp,
      },
      action: cut
        ? {
            kind: 'ads_budget',
            title: `Lead cost on "${name}" is up ${pctUp}%`,
            body: `Leads on this campaign now cost ${eur(recent.cplCents)} — up from your ${eur(baseline.cplCents)} average. I've drafted a budget cut from ${eur(budget!)} to ${eur(cut)}/day to limit the damage while the cost settles. Approve to apply it on Meta.`,
            explanation: `Detected: cost-per-lead spike — ${eur(recent.cplCents)} vs ${eur(baseline.cplCents)} baseline`,
            payload: { ...basePayload, newDailyBudgetCents: cut },
            urgency: 'normal',
          }
        : {
            kind: 'ads_pause',
            title: `Lead cost on "${name}" is up ${pctUp}%`,
            body: `Leads on this campaign now cost ${eur(recent.cplCents)} — up from your ${eur(baseline.cplCents)} average. I'd pause it while you review. Approving pauses it on Meta right away.`,
            explanation: `Detected: cost-per-lead spike — ${eur(recent.cplCents)} vs ${eur(baseline.cplCents)} baseline`,
            payload: basePayload,
            urgency: 'normal',
          },
    });
  }

  // Performing well — cheap leads while fully pacing: draft a budget raise.
  if (
    baseline.leads >= 3 &&
    baseline.cplCents !== null &&
    recent.leads >= 2 &&
    recent.cplCents !== null &&
    recent.cplCents <= baseline.cplCents * 0.65 &&
    budget != null &&
    recent.days > 0 &&
    recent.spendCents / recent.days >= budget * 0.8
  ) {
    const raise = Math.round(budget * 1.5);
    const pctDown = Math.round((1 - recent.cplCents / baseline.cplCents) * 100);
    detections.push({
      flagType: 'performing_well',
      metrics: {
        baselineCplCents: baseline.cplCents,
        recentCplCents: recent.cplCents,
        pctDown,
      },
      action: {
        kind: 'ads_budget',
        title: `"${name}" is winning — budget increase drafted`,
        body: `This campaign is getting leads at ${eur(recent.cplCents)} — ${pctDown}% cheaper than your recent average — and it's spending its full budget. I've drafted an increase from ${eur(budget)} to ${eur(raise)}/day so it can catch more of the demand. Approve to apply it on Meta.`,
        explanation: `Detected: strong performance — ${eur(recent.cplCents)}/lead vs ${eur(baseline.cplCents)} baseline`,
        payload: { ...basePayload, newDailyBudgetCents: raise },
        urgency: 'normal',
      },
    });
  }

  // Spend-not-pacing — delivering well under budget: limited delivery /
  // creative fatigue signal. Acknowledge-only (a refresh is a judgement call).
  if (
    budget != null &&
    budget >= 500 &&
    recent.days >= 3 &&
    recent.spendCents / recent.days < budget * 0.2 &&
    campaign.status === 'active'
  ) {
    detections.push({
      flagType: 'spend_not_pacing',
      metrics: {
        dailyBudgetCents: budget,
        avgDailySpendCents: Math.round(recent.spendCents / recent.days),
      },
      action: {
        kind: 'ads_creative_refresh',
        title: `"${name}" isn't spending its budget`,
        body: `This campaign is set to ${eur(budget)}/day but only spending about ${eur(Math.round(recent.spendCents / recent.days))}/day. That usually means the audience is tapped out or the creative has gone stale — a fresh image and copy normally fixes it. Approve to acknowledge; refresh the creative from the campaign page.`,
        explanation: 'Detected: limited delivery — spending under 20% of budget',
        payload: basePayload,
        urgency: 'normal',
      },
    });
  }

  return detections;
}

function dedupeKeyFor(flagType: FlagType, campaignDbId: string): string {
  return `ads:${flagType}:${campaignDbId}`;
}

registerJobHandler(META_DETECT_ANOMALIES_JOB, async (rawPayload) => {
  const payload = (rawPayload ?? {}) as { clientId?: unknown };
  const clientId = typeof payload.clientId === 'string' ? payload.clientId : null;
  if (!clientId) throw new Error('meta_detect_anomalies: missing clientId');

  const db = getIntegrationDb();

  const { data: campaignData, error: campaignError } = await db
    .from('meta_campaigns')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['active', 'with_issues']);
  if (campaignError) {
    throw new Error(`meta_detect_anomalies: campaigns read — ${campaignError.message}`);
  }
  const campaigns = (campaignData as MetaCampaignRow[] | null) ?? [];
  if (campaigns.length === 0) return { scanned: 0 };

  const sinceDate = new Date(Date.now() - 11 * 86_400_000).toISOString().slice(0, 10);
  const { data: insightData, error: insightError } = await db
    .from('meta_ads_insights')
    .select('*')
    .eq('client_id', clientId)
    .gte('date_recorded', sinceDate);
  if (insightError) {
    throw new Error(`meta_detect_anomalies: insights read — ${insightError.message}`);
  }
  const insights = (insightData as MetaAdsInsightsRow[] | null) ?? [];

  const recentCutoff = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  let flagged = 0;

  for (const campaign of campaigns) {
    const rows = insights.filter((r) => r.meta_campaign_id === campaign.id);
    const baseline = statsFor(rows.filter((r) => r.date_recorded < recentCutoff));
    const recent = statsFor(rows.filter((r) => r.date_recorded >= recentCutoff));

    const detections = detect(campaign, baseline, recent);
    const detectedTypes = new Set(detections.map((d) => d.flagType));

    // Resolve open flags whose condition cleared + expire their pending card.
    const { data: openFlagData } = await db
      .from('meta_campaign_flags')
      .select('id, flag_type')
      .eq('meta_campaign_db_id', campaign.id)
      .eq('status', 'open');
    const openFlags = (openFlagData as { id: string; flag_type: FlagType }[] | null) ?? [];
    for (const flag of openFlags) {
      if (detectedTypes.has(flag.flag_type)) continue;
      await db
        .from('meta_campaign_flags')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', flag.id);
      await db
        .from('suggested_actions')
        .update({ status: 'expired', resolved_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .eq('dedupe_key', dedupeKeyFor(flag.flag_type, campaign.id))
        .eq('status', 'pending');
    }
    const openTypes = new Set(openFlags.map((f) => f.flag_type));

    // Write fresh flags + their cards. An already-open flag keeps its
    // existing card (the queue is exception-based — no daily re-noise).
    for (const detection of detections) {
      if (openTypes.has(detection.flagType)) continue;
      const { error: insertError } = await db.from('meta_campaign_flags').insert({
        client_id: clientId,
        meta_campaign_db_id: campaign.id,
        flag_type: detection.flagType,
        metrics: detection.metrics,
      });
      if (insertError) {
        // Unique-index race with a concurrent run — skip, the other run won.
        console.warn('[meta-anomaly] flag insert skipped', insertError.message);
        continue;
      }
      flagged += 1;
      if (detection.action) {
        await createSuggestedAction({
          clientId,
          kind: detection.action.kind,
          title: detection.action.title,
          body: detection.action.body,
          explanation: detection.action.explanation,
          payload: detection.action.payload,
          sourceEntityType: 'meta_campaign',
          sourceEntityId: campaign.id,
          dedupeKey: dedupeKeyFor(detection.flagType, campaign.id),
          urgency: detection.action.urgency,
          // Ads conditions re-evaluate daily — a 3-day shelf life keeps the
          // queue honest if the cron stops re-confirming.
          expiresInHours: 72,
        });
      }
    }
  }

  return { scanned: campaigns.length, flagged };
});
