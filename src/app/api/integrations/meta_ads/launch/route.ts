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
  // Closed-set objective. Defaults to 'lead_form_meta' for back-compat
  // with bodies posted from pre-1.2 callers.
  const campaignObjectiveRaw = body.campaignObjective;
  const campaignObjective:
    | 'lead_form_meta'
    | 'lead_form_landing' =
    campaignObjectiveRaw === 'lead_form_landing' ? 'lead_form_landing' : 'lead_form_meta';
  const pixelIdRaw = body.pixelId;
  const pixelId: string | null =
    typeof pixelIdRaw === 'string' && pixelIdRaw.length > 0 ? pixelIdRaw : null;
  if (campaignObjective === 'lead_form_landing' && !pixelId) {
    return { error: 'missing-pixelId' };
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
  const interests = Array.isArray(targeting.interests)
    ? (targeting.interests as unknown[])
        .filter(
          (v): v is { id: string; name: string } =>
            v != null &&
            typeof v === 'object' &&
            typeof (v as { id?: unknown }).id === 'string' &&
            typeof (v as { name?: unknown }).name === 'string',
        )
        .slice(0, 10)
    : [];
  const cities = Array.isArray(targeting.cities)
    ? (targeting.cities as unknown[])
        .filter(
          (v): v is { key: string; label: string; radiusKm: number } => {
            if (v == null || typeof v !== 'object') return false;
            const o = v as { key?: unknown; label?: unknown; radiusKm?: unknown };
            return (
              typeof o.key === 'string' &&
              typeof o.label === 'string' &&
              typeof o.radiusKm === 'number' &&
              o.radiusKm > 0
            );
          },
        )
        .map((v) => ({ key: v.key, label: v.label, radiusKm: Math.round(v.radiusKm) }))
        .slice(0, 5)
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
  if (typeof startTimeIso !== 'string' || !isValidIso(startTimeIso)) {
    return { error: 'invalid-startTimeIso' };
  }
  // endTimeIso is nullable — null = "run until stopped" (no Meta end time).
  const endTimeRaw = body.endTimeIso;
  let endTimeIso: string | null = null;
  if (endTimeRaw === null) {
    endTimeIso = null;
  } else if (typeof endTimeRaw === 'string') {
    if (!isValidIso(endTimeRaw)) {
      return { error: 'invalid-endTimeIso' };
    }
    if (new Date(endTimeRaw).getTime() <= new Date(startTimeIso).getTime()) {
      return { error: 'invalid-schedule' };
    }
    endTimeIso = endTimeRaw;
  } else if (endTimeRaw !== undefined) {
    return { error: 'invalid-endTimeIso' };
  }

  const creative = body.creative as Record<string, unknown> | undefined;
  if (!creative || typeof creative !== 'object') {
    return { error: 'missing-creative' };
  }
  // V1.4c adFormat: 'single_image' (default) keeps the M × N matrix
  // from Session 1.4a. 'carousel' collapses the per-image axis into
  // one multi-card carousel ad per ad set.
  const adFormatRaw = creative.adFormat;
  const adFormat: 'single_image' | 'carousel' =
    adFormatRaw === 'carousel' ? 'carousel' : 'single_image';
  // V1.4 matrix: images[] entries. Single-image caps at 5 (Meta's
  // optimisation dilutes past that for the ad axis); carousel caps at
  // 10 (Meta's hard max for card count).
  const imageCap = adFormat === 'carousel' ? 10 : 5;
  const imagesRaw = Array.isArray(creative.images) ? creative.images : [];
  const images: Array<{
    imageUrl: string;
    imageWidth: number | null;
    imageHeight: number | null;
  }> = [];
  for (let i = 0; i < imagesRaw.length && images.length < imageCap; i += 1) {
    const item = imagesRaw[i];
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.imageUrl === 'string' ? o.imageUrl : '';
    if (url.length === 0) continue;
    images.push({
      imageUrl: url,
      imageWidth: typeof o.imageWidth === 'number' ? Math.round(o.imageWidth) : null,
      imageHeight: typeof o.imageHeight === 'number' ? Math.round(o.imageHeight) : null,
    });
  }
  if (images.length === 0) {
    return { error: 'missing-creative.images' };
  }
  if (adFormat === 'carousel' && images.length < 2) {
    return { error: 'carousel-needs-2-images' };
  }
  // V1.3 multi-variant: the body carries `variants[]` (one creative
  // per launched variant inside the same ad set). Capped at 10 — Meta
  // technically allows more but performance signal dilutes past ~5.
  const variantsRaw = Array.isArray(creative.variants) ? creative.variants : [];
  const variants: Array<{
    headline: string;
    primaryText: string;
    description: string | null;
    ctaType: string;
  }> = [];
  for (let i = 0; i < variantsRaw.length && variants.length < 10; i += 1) {
    const v = variantsRaw[i];
    if (!v || typeof v !== 'object') continue;
    const obj = v as Record<string, unknown>;
    const headline = typeof obj.headline === 'string' ? obj.headline.trim() : '';
    const primaryText =
      typeof obj.primaryText === 'string' ? obj.primaryText.trim() : '';
    if (headline.length === 0 || primaryText.length === 0) continue;
    variants.push({
      headline,
      primaryText,
      description:
        typeof obj.description === 'string' && obj.description.length > 0
          ? obj.description
          : null,
      ctaType:
        typeof obj.ctaType === 'string' && obj.ctaType.length > 0
          ? obj.ctaType
          : 'LEARN_MORE',
    });
  }
  if (variants.length === 0) {
    return { error: 'missing-creative.variants' };
  }
  const linkUrl = creative.linkUrl;
  if (typeof linkUrl !== 'string' || linkUrl.length === 0) {
    return { error: 'missing-creative.linkUrl' };
  }
  const privacyPolicyUrl = creative.privacyPolicyUrl;
  if (typeof privacyPolicyUrl !== 'string' || privacyPolicyUrl.length === 0) {
    return { error: 'missing-creative.privacyPolicyUrl' };
  }

  return {
    clientId,
    launchedByUserId,
    templateSlug,
    campaignName,
    campaignObjective,
    pixelId,
    targetingGeoCenter: geoCenter,
    targetingRadiusKm: radiusKm,
    targetingCities: cities,
    targetingAgeMin: ageMin,
    targetingAgeMax: ageMax,
    targetingInterestTokens: interestTokens,
    targetingInterests: interests,
    targetingCountries: countries,
    dailyBudgetCents,
    startTimeIso,
    endTimeIso,
    images,
    variants,
    linkUrl,
    privacyPolicyUrl,
    adFormat,
    isFirstLaunch: Boolean(body.isFirstLaunch),
    goLive: Boolean(body.goLive),
  };
}

function isValidIso(value: string): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time);
}
