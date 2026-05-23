// =============================================================================
// Google Business Profile — the typed API wrapper.
//
// Phase 7 GBP. Every call goes through `callWithToken()` so the per-tenant
// access token is fresh, a 401 triggers exactly one refresh-and-retry, and
// every attempt is logged to integration_call_log via callExternal().
//
// Google split the Business Profile APIs across multiple hostnames in 2022:
//   • mybusinessaccountmanagement.googleapis.com  — accounts list
//   • mybusinessbusinessinformation.googleapis.com — locations CRUD
//   • mybusiness.googleapis.com/v4                — reviews, reply, posts,
//                                                   insights (the legacy
//                                                   surface that still owns
//                                                   conversational data)
//
// V1 SCOPE: location data, reviews list, review reply. Posts + insights are
// V1.1 — function stubs return a clear "not implemented" IntegrationResult.
//
// SERVER-ONLY — imports env + callExternal which holds the service-role
// client for logging.
// =============================================================================

import { env } from '@/lib/env';
import { callExternal, type IntegrationResult } from '@/lib/integrations/_shared/call';
import { callWithToken } from '@/lib/integrations/_shared/api-call-with-token';

import type {
  GbpAccount,
  GbpAccountsResponse,
  GbpLocation,
  GbpLocationsResponse,
  GbpReview,
  GbpReviewsResponse,
} from './types';

// --- endpoints ---------------------------------------------------------------

const ACCOUNT_MGMT_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const V4_BASE = 'https://mybusiness.googleapis.com/v4';

/** The readMask passed to listLocations / getLocation — the subset of
 *  location fields we persist or display. Google rejects requests without
 *  an explicit readMask. */
const LOCATION_READ_MASK = [
  'name',
  'title',
  'storefrontAddress',
  'phoneNumbers',
  'websiteUri',
  'metadata',
].join(',');

// --- configuration check -----------------------------------------------------

/** True when the GBP OAuth app credentials are configured (and therefore the
 *  full GBP flow — connect, sync, send — can run). Mirrors isTwilioConfigured()
 *  + isResendConfigured(): a single function the callers gate on. */
export function isGbpConfigured(): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

// --- helpers -----------------------------------------------------------------

/** Compose the two stored resource-name halves into the full path GBP's
 *  reviews API expects: "accounts/123/locations/456". */
export function composeLocationPath(
  gbpAccountId: string,
  gbpLocationId: string,
): string {
  // Both are stored with their respective prefixes already
  // ("accounts/X" + "locations/Y") — guard against doubled separators.
  const left = gbpAccountId.replace(/\/$/, '');
  const right = gbpLocationId.replace(/^\//, '');
  return `${left}/${right}`;
}

/** Compose the deep-link a customer follows to leave a review. Two paths:
 *  1. Prefer `location.metadata.newReviewUri` when GBP returns it (it is the
 *     canonical "leave a review" URL Google itself generates).
 *  2. Fall back to the placeId-based search.google.com URL — the canonical
 *     manual form. Returns null if neither is available. */
export function buildReviewLink(location: GbpLocation): string | null {
  const newReview = location.metadata?.newReviewUri;
  if (typeof newReview === 'string' && newReview.length > 0) return newReview;
  const placeId = location.metadata?.placeId;
  if (typeof placeId === 'string' && placeId.length > 0) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
  }
  return null;
}

/** Compose a single-line address from GBP's structured address. */
export function formatLocationAddress(location: GbpLocation): string | null {
  const a = location.storefrontAddress;
  if (!a) return null;
  const parts = [
    ...(a.addressLines ?? []),
    a.locality,
    a.administrativeArea,
    a.postalCode,
    a.regionCode,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
}

// --- accounts ----------------------------------------------------------------

/** List all GBP accounts the connected Google user can manage. Used during
 *  the post-OAuth location-picker flow to know which accounts to scan for
 *  locations. */
export async function listAccounts(
  clientId: string,
): Promise<IntegrationResult<GbpAccount[]>> {
  return callWithToken<GbpAccount[]>(
    clientId,
    'google_business_profile',
    async (accessToken) => {
      const result = await callExternal<GbpAccountsResponse>({
        provider: 'google_business_profile',
        operation: 'list_accounts',
        url: `${ACCOUNT_MGMT_BASE}/accounts`,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.accounts ?? [], status: result.status };
    },
  );
}

// --- locations ---------------------------------------------------------------

/** List every location under one account. `accountName` is the full resource
 *  name including the "accounts/" prefix (e.g. "accounts/123456789"). */
export async function listLocations(
  clientId: string,
  accountName: string,
): Promise<IntegrationResult<GbpLocation[]>> {
  return callWithToken<GbpLocation[]>(
    clientId,
    'google_business_profile',
    async (accessToken) => {
      const url = new URL(`${BUSINESS_INFO_BASE}/${accountName}/locations`);
      url.searchParams.set('readMask', LOCATION_READ_MASK);
      url.searchParams.set('pageSize', '100');
      const result = await callExternal<GbpLocationsResponse>({
        provider: 'google_business_profile',
        operation: 'list_locations',
        url: url.toString(),
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data.locations ?? [], status: result.status };
    },
  );
}

/** Fetch full detail for one location. `locationName` is the resource name
 *  with the "locations/" prefix (e.g. "locations/987654321"). */
export async function getLocation(
  clientId: string,
  locationName: string,
): Promise<IntegrationResult<GbpLocation>> {
  return callWithToken<GbpLocation>(
    clientId,
    'google_business_profile',
    async (accessToken) => {
      const url = new URL(`${BUSINESS_INFO_BASE}/${locationName}`);
      url.searchParams.set('readMask', LOCATION_READ_MASK);
      const result = await callExternal<GbpLocation>({
        provider: 'google_business_profile',
        operation: 'get_location',
        url: url.toString(),
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        clientId,
      });
      if (!result.ok) return result;
      return { ok: true, data: result.data, status: result.status };
    },
  );
}

// --- reviews -----------------------------------------------------------------

/** List recent reviews for a location. `locationPath` is the FULL path —
 *  "accounts/.../locations/..." — required by the v4 endpoint. Use
 *  `composeLocationPath()` to build it from the stored row halves.
 *
 *  Default pageSize=50 is what the v4 API allows; pass a smaller value for
 *  manual polls when the operator pressed "Sync now". */
export async function listReviews(
  clientId: string,
  locationPath: string,
  pageSize: number = 50,
  pageToken?: string,
): Promise<IntegrationResult<GbpReviewsResponse>> {
  return callWithToken<GbpReviewsResponse>(
    clientId,
    'google_business_profile',
    async (accessToken) => {
      const url = new URL(`${V4_BASE}/${locationPath}/reviews`);
      url.searchParams.set('pageSize', String(Math.min(Math.max(pageSize, 1), 50)));
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const result = await callExternal<GbpReviewsResponse>({
        provider: 'google_business_profile',
        operation: 'list_reviews',
        url: url.toString(),
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        clientId,
      });
      return result;
    },
  );
}

/** Reply to a single review. `reviewName` is the full review resource name:
 *  "accounts/{a}/locations/{l}/reviews/{r}". Replaces any existing reply
 *  (Google's API is PUT — there is no separate update endpoint). */
export async function replyToReview(
  clientId: string,
  reviewName: string,
  replyText: string,
): Promise<IntegrationResult<{ comment?: string; updateTime?: string }>> {
  return callWithToken<{ comment?: string; updateTime?: string }>(
    clientId,
    'google_business_profile',
    async (accessToken) => {
      const result = await callExternal<{ comment?: string; updateTime?: string }>({
        provider: 'google_business_profile',
        operation: 'reply_to_review',
        url: `${V4_BASE}/${reviewName}/reply`,
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: { comment: replyText },
        clientId,
      });
      return result;
    },
  );
}

// --- V1.1 stubs --------------------------------------------------------------
//
// Posts + insights are V1.1. Stubbed here so future callers know the shape,
// and the operator can wire them when the time comes. NOT called from the
// V1 surface.

/** V1.1 stub: createPost — publish a local post to a GBP location. Returns
 *  a non_retryable error in V1 so any call site fails fast and is easy to
 *  find when the V1.1 work starts. */
export async function createPost(
  _clientId: string,
  _locationPath: string,
  _postContent: unknown,
): Promise<IntegrationResult<never>> {
  return {
    ok: false,
    error: {
      class: 'non_retryable',
      message: 'createPost is V1.1 — not implemented in the V1 GBP scope.',
      provider: 'google_business_profile',
      operation: 'create_post',
    },
  };
}

/** V1.1 stub: getInsights — the views/searches/actions analytics surface.
 *  Same fast-fail shape as createPost. */
export async function getInsights(
  _clientId: string,
  _locationPath: string,
  _dateRange: { start: string; end: string },
): Promise<IntegrationResult<never>> {
  return {
    ok: false,
    error: {
      class: 'non_retryable',
      message: 'getInsights is V1.1 — not implemented in the V1 GBP scope.',
      provider: 'google_business_profile',
      operation: 'get_insights',
    },
  };
}
