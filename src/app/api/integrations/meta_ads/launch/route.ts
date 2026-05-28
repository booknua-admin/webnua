// =============================================================================
// /api/integrations/meta_ads/launch
//
// Phase 7.5 Session 1. The operator-only POST route that drives the
// in-app Meta lead-form campaign launch flow.
//
// Auth: requireOperatorForClient — campaign creation is operator
// governance under the managed-service model. Distinct from connection
// management (which is requireClientAccess for per-tenant OAuth).
//
// Body shape (all fields required unless noted):
//   {
//     clientId, templateSlug, campaignName,
//     targeting: { geoCenter?, radiusKm?, ageMin, ageMax, interestTokens, countries },
//     dailyBudgetCents, startTimeIso, endTimeIso,
//     creative: { imageUrl, imageWidth?, imageHeight?, headline, primaryText,
//                 description?, ctaType, linkUrl, privacyPolicyUrl },
//     isFirstLaunch, goLive
//   }
//
// Responses:
//   200 → { ok: true, campaignId, metaCampaignId, metaCampaignDbId, paused }
//   400 → { error: 'invalid-body' | 'missing-<field>' | 'invalid-<field>' }
//   403 → { error: 'forbidden' | 'forbidden-client' }
//   503 → { error: 'meta-not-configured' }
//   502 → { error: 'launch-failed', step, detail?, partial? }
//
// =============================================================================

import { NextResponse } from 'next/server';

import { isMetaConfigured } from '@/lib/integrations/meta-ads/client';
import {
  launchMetaCampaign,
  type LaunchCampaignInput,
} from '@/lib/integrations/meta-ads/launch-orchestrator';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
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

  const input = parseLaunchInput(body, clientId, auth.userId);
  if ('error' in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }

  const result = await launchMetaCampaign(input);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: 'launch-failed',
        step: result.step,
        message: result.message,
        detail: result.detail,
        partial: result.partial,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    campaignId: result.campaignId,
    metaCampaignId: result.metaCampaignId,
    metaCampaignDbId: result.metaCampaignDbId,
    paused: result.paused,
  });
}

// --- body validation ---------------------------------------------------------

type ParseOk = LaunchCampaignInput;
type ParseErr = { error: string };

function parseLaunchInput(
  body: Record<string, unknown>,
  clientId: string,
  launchedByUserId: string,
): ParseOk | ParseErr {
  const templateSlug = body.templateSlug;
  if (typeof templateSlug !== 'string' || templateSlug.length === 0) {
    return { error: 'missing-templateSlug' };
  }
  const campaignName = body.campaignName;
  if (typeof campaignName !== 'string' || campaignName.length === 0) {
    return { error: 'missing-campaignName' };
  }
  const targeting = body.targeting as Record<string, unknown> | undefined;
  if (!targeting || typeof targeting !== 'object') {
    return { error: 'missing-targeting' };
  }
  const ageMin = Number(targeting.ageMin);
  const ageMax = Number(targeting.ageMax);
  if (!Number.isInteger(ageMin) || ageMin < 13 || ageMin > 65) {
    return { error: 'invalid-ageMin' };
  }
  if (!Number.isInteger(ageMax) || ageMax < ageMin || ageMax > 65) {
    return { error: 'invalid-ageMax' };
  }
  const interestTokens = Array.isArray(targeting.interestTokens)
    ? (targeting.interestTokens as unknown[]).filter(
        (s): s is string => typeof s === 'string',
      )
    : [];
  const countries = Array.isArray(targeting.countries)
    ? (targeting.countries as unknown[]).filter(
        (s): s is string => typeof s === 'string',
      )
    : [];
  if (countries.length === 0) {
    return { error: 'missing-targeting.countries' };
  }
  let geoCenter: { lat: number; lng: number } | null = null;
  const geoCenterRaw = targeting.geoCenter as
    | { lat?: unknown; lng?: unknown }
    | undefined
    | null;
  if (geoCenterRaw && typeof geoCenterRaw === 'object') {
    const lat = Number(geoCenterRaw.lat);
    const lng = Number(geoCenterRaw.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      geoCenter = { lat, lng };
    }
  }
  const radiusKm =
    typeof targeting.radiusKm === 'number' && targeting.radiusKm > 0
      ? Math.round(targeting.radiusKm)
      : null;

  const dailyBudgetCents = Number(body.dailyBudgetCents);
  if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents < 100) {
    return { error: 'invalid-dailyBudgetCents' };
  }
  const startTimeIso = body.startTimeIso;
  const endTimeIso = body.endTimeIso;
  if (typeof startTimeIso !== 'string' || !isValidIso(startTimeIso)) {
    return { error: 'invalid-startTimeIso' };
  }
  if (typeof endTimeIso !== 'string' || !isValidIso(endTimeIso)) {
    return { error: 'invalid-endTimeIso' };
  }
  if (new Date(endTimeIso).getTime() <= new Date(startTimeIso).getTime()) {
    return { error: 'invalid-schedule' };
  }

  const creative = body.creative as Record<string, unknown> | undefined;
  if (!creative || typeof creative !== 'object') {
    return { error: 'missing-creative' };
  }
  const imageUrl = creative.imageUrl;
  if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
    return { error: 'missing-creative.imageUrl' };
  }
  const headline = creative.headline;
  const primaryText = creative.primaryText;
  if (typeof headline !== 'string' || headline.length === 0) {
    return { error: 'missing-creative.headline' };
  }
  if (typeof primaryText !== 'string' || primaryText.length === 0) {
    return { error: 'missing-creative.primaryText' };
  }
  const description =
    typeof creative.description === 'string' ? creative.description : null;
  const ctaType =
    typeof creative.ctaType === 'string' && creative.ctaType.length > 0
      ? creative.ctaType
      : 'LEARN_MORE';
  const linkUrl = creative.linkUrl;
  if (typeof linkUrl !== 'string' || linkUrl.length === 0) {
    return { error: 'missing-creative.linkUrl' };
  }
  const privacyPolicyUrl = creative.privacyPolicyUrl;
  if (typeof privacyPolicyUrl !== 'string' || privacyPolicyUrl.length === 0) {
    return { error: 'missing-creative.privacyPolicyUrl' };
  }
  const imageWidth =
    typeof creative.imageWidth === 'number' ? Math.round(creative.imageWidth) : null;
  const imageHeight =
    typeof creative.imageHeight === 'number' ? Math.round(creative.imageHeight) : null;

  return {
    clientId,
    launchedByUserId,
    templateSlug,
    campaignName,
    targetingGeoCenter: geoCenter,
    targetingRadiusKm: radiusKm,
    targetingAgeMin: ageMin,
    targetingAgeMax: ageMax,
    targetingInterestTokens: interestTokens,
    targetingCountries: countries,
    dailyBudgetCents,
    startTimeIso,
    endTimeIso,
    imageUrl,
    imageWidth,
    imageHeight,
    headline,
    primaryText,
    description,
    ctaType,
    linkUrl,
    privacyPolicyUrl,
    isFirstLaunch: Boolean(body.isFirstLaunch),
    goLive: Boolean(body.goLive),
  };
}

function isValidIso(value: string): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time);
}
