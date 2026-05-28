// =============================================================================
// /api/integrations/meta_ads/targeting-search
//
// Phase 7.5 Session 1.1. Operator-only debounced autocomplete proxy for
// Meta's `/search` endpoint — the launch wizard's step 2 uses this to
// resolve city / interest strings to the structured ids Meta's targeting
// API actually accepts.
//
// Two modes, dispatched on `type`:
//   • 'cities'   — Meta `type=adgeolocation`, location_types=['city']
//   • 'interests'— Meta `type=adinterest`
//
// Body:
//   { clientId, type: 'cities' | 'interests', query, countryCode? }
//
// Responses:
//   200 → { results: Array<{ id, label, sublabel?, audienceSize? }> }
//   400 → { error: 'invalid-body' | 'missing-<field>' | 'query-too-short' }
//   403 → { error: 'forbidden' | 'forbidden-client' }
//   503 → { error: 'meta-not-configured' }
//   502 → { error: 'search-failed', detail }
//
// Auth: requireOperatorForClient (campaign-building governance, same
// shape as the launch route).
// =============================================================================

import { NextResponse } from 'next/server';

import {
  isMetaConfigured,
  searchAdGeoLocations,
  searchAdInterests,
} from '@/lib/integrations/meta-ads/client';
import { requireOperatorForClient } from '@/lib/integrations/_shared/operator-auth';

export const maxDuration = 15;

type TargetingResult = {
  id: string;
  label: string;
  sublabel?: string;
  audienceSize?: { lower: number; upper: number };
};

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

  const type = body.type;
  const query = body.query;
  if (type !== 'cities' && type !== 'interests') {
    return NextResponse.json({ error: 'missing-type' }, { status: 400 });
  }
  if (typeof query !== 'string' || query.trim().length < 2) {
    return NextResponse.json({ error: 'query-too-short' }, { status: 400 });
  }
  const countryCode =
    typeof body.countryCode === 'string' ? body.countryCode.toUpperCase() : undefined;

  if (type === 'cities') {
    const result = await searchAdGeoLocations(clientId, query.trim(), {
      countryCode,
      limit: 10,
      locationTypes: ['city'],
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: 'search-failed', detail: result.error.message },
        { status: 502 },
      );
    }
    const shaped: TargetingResult[] = result.data
      .filter((row) => row.key && row.name)
      .map((row) => ({
        id: row.key as string,
        label: row.name as string,
        sublabel: [row.region, row.country_name].filter(Boolean).join(', ') || undefined,
      }));
    return NextResponse.json({ results: shaped });
  }

  // type === 'interests'
  const result = await searchAdInterests(clientId, query.trim(), { limit: 10 });
  if (!result.ok) {
    return NextResponse.json(
      { error: 'search-failed', detail: result.error.message },
      { status: 502 },
    );
  }
  const shaped: TargetingResult[] = result.data
    .filter((row) => row.id && row.name)
    .map((row) => ({
      id: row.id as string,
      label: row.name as string,
      sublabel: row.path?.length ? row.path.join(' › ') : row.topic,
      audienceSize:
        row.audience_size_lower_bound != null && row.audience_size_upper_bound != null
          ? {
              lower: row.audience_size_lower_bound,
              upper: row.audience_size_upper_bound,
            }
          : undefined,
    }));
  return NextResponse.json({ results: shaped });
}
