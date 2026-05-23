// =============================================================================
// /api/integrations/google_business_profile/locations
//
// The post-OAuth location-picker surface. Client-or-operator (the customer's
// own GBP listing).
//
//   POST { clientId, action: 'list' }
//     Hits Google's account + location APIs to surface every GBP location
//     the connected OAuth user can manage, returning a flat list the UI
//     presents as the pick screen.
//
//   POST { clientId, action: 'select', accountName, locationName, title? }
//     Persists the chosen location into client_gbp_locations and
//     immediately enqueues a gbp_sync_reviews job with refreshLocation=true
//     so the headline metrics + review_link populate without waiting for
//     the daily cron.
//
// Returns 503 when the OAuth provider is unconfigured (which would
// otherwise produce confusing 500s in the consent step before any of this).
// =============================================================================

import { NextResponse } from 'next/server';

import {
  composeLocationPath,
  buildReviewLink,
  formatLocationAddress,
  getLocation,
  isGbpConfigured,
  listAccounts,
  listLocations,
} from '@/lib/integrations/gbp/client';
import { upsertLocation } from '@/lib/integrations/gbp/locations';
import {
  GBP_SYNC_REVIEWS_JOB,
  type GbpSyncReviewsPayload,
} from '@/lib/integrations/gbp/job-types';
import { enqueueJobImmediate } from '@/lib/integrations/_shared/jobs';
import { requireClientAccess } from '@/lib/integrations/_shared/operator-auth';

type ListAction = { action: 'list'; clientId: string };
type SelectAction = {
  action: 'select';
  clientId: string;
  accountName: string;
  locationName: string;
  title?: string;
};

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

  const auth = await requireClientAccess(request, clientId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isGbpConfigured()) {
    return NextResponse.json({ error: 'gbp-not-configured' }, { status: 503 });
  }

  const action = body.action;
  if (action === 'list') {
    return handleList({ action: 'list', clientId });
  }
  if (action === 'select') {
    const accountName = body.accountName;
    const locationName = body.locationName;
    if (typeof accountName !== 'string' || !accountName.startsWith('accounts/')) {
      return NextResponse.json({ error: 'invalid-accountName' }, { status: 400 });
    }
    if (typeof locationName !== 'string' || !locationName.startsWith('locations/')) {
      return NextResponse.json({ error: 'invalid-locationName' }, { status: 400 });
    }
    const title = typeof body.title === 'string' ? body.title : undefined;
    return handleSelect({ action: 'select', clientId, accountName, locationName, title });
  }
  return NextResponse.json({ error: 'unknown-action' }, { status: 400 });
}

// --- list --------------------------------------------------------------------

async function handleList(input: ListAction): Promise<Response> {
  const accountsResult = await listAccounts(input.clientId);
  if (!accountsResult.ok) {
    return NextResponse.json(
      { error: 'list-accounts-failed', detail: accountsResult.error.message },
      { status: 502 },
    );
  }
  const accounts = accountsResult.data
    .map((a) => ({ name: a.name, accountName: a.accountName ?? a.name ?? '' }))
    .filter((a): a is { name: string; accountName: string } => Boolean(a.name));

  // Fetch every account's locations in parallel — most operators have one
  // account so this is one call; for the rare multi-account case we don't
  // want a serial wait.
  const buckets = await Promise.all(
    accounts.map(async (account) => {
      const result = await listLocations(input.clientId, account.name);
      if (!result.ok) {
        return { account, locations: [], error: result.error.message };
      }
      return {
        account,
        locations: result.data
          .map((loc) => ({
            name: loc.name,
            title: loc.title ?? '(untitled location)',
            address: formatLocationAddress(loc),
            placeId: loc.metadata?.placeId,
          }))
          .filter(
            (loc): loc is {
              name: string;
              title: string;
              address: string | null;
              placeId: string | undefined;
            } => Boolean(loc.name),
          ),
        error: null as string | null,
      };
    }),
  );

  return NextResponse.json({ accounts: buckets });
}

// --- select ------------------------------------------------------------------

async function handleSelect(input: SelectAction): Promise<Response> {
  const { clientId, accountName, locationName, title } = input;

  // Fetch the location detail up front so the row is persisted with a
  // usable review_link + cached title/address (no need to wait for the
  // sync job for the FIRST display).
  const locResult = await getLocation(clientId, locationName);

  let row;
  try {
    row = await upsertLocation({
      client_id: clientId,
      gbp_account_id: accountName,
      gbp_location_id: locationName,
      location_title: locResult.ok ? (locResult.data.title ?? title ?? '') : (title ?? ''),
      address: locResult.ok ? formatLocationAddress(locResult.data) : null,
      phone: locResult.ok ? (locResult.data.phoneNumbers?.primaryPhone ?? null) : null,
      website: locResult.ok ? (locResult.data.websiteUri ?? null) : null,
      review_link: locResult.ok ? buildReviewLink(locResult.data) : null,
      last_synced_at: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'upsert-failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }

  // Fire-and-forget an initial sync — the cron also picks it up daily.
  try {
    await enqueueJobImmediate(
      GBP_SYNC_REVIEWS_JOB,
      { clientId, refreshLocation: true } satisfies GbpSyncReviewsPayload,
      { provider: 'google_business_profile', clientId, correlationId: row.id },
    );
  } catch (error) {
    // Don't fail the select — the cron will catch it.
    console.warn('[gbp/locations.select] initial sync enqueue failed', error);
  }

  // Composing the path lets the UI know which API path the sync job
  // resolves to (handy for debugging).
  const path = composeLocationPath(accountName, locationName);
  const composedPath: string = path;
  return NextResponse.json({
    location: {
      id: row.id,
      gbpAccountId: row.gbp_account_id,
      gbpLocationId: row.gbp_location_id,
      title: row.location_title,
      reviewLink: row.review_link,
      path: composedPath,
    },
  });
}
