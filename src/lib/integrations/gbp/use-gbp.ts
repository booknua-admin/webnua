'use client';

// =============================================================================
// Google Business Profile — operator + client UI data layer.
//
// Phase 7 GBP UI consolidation: reads + mutations behind the surfaces that
// absorbed the GBP UI — `/reviews` (operator + client; via /lib/reviews/
// queries.tsx for the reviews list, this module for the reply mutation),
// `/leads/[id]` + `/bookings/[id]` (the manual review-request affordance),
// and `/settings/integrations` (the GBP connection footer + post-OAuth
// location picker). The /settings/google-business tab is gone — these
// hooks are mounted from the shared surfaces.
//
// Tables read directly with the RLS-scoped browser client (untyped cast —
// gbp tables are not yet in the generated Database type), same pattern as
// use-sms.ts / use-email.ts. Mutations POST the operator routes under
// /api/integrations/google_business_profile/*.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type {
  ClientGbpLocationRow,
  GbpReviewRequestRow,
  GbpReviewRow,
} from './types';

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const locationKey = (clientId: string | null) => ['gbp-location', clientId] as const;
const reviewsKey = (clientId: string | null) => ['gbp-reviews', clientId] as const;
const requestsKey = (clientId: string | null) => ['gbp-review-requests', clientId] as const;

// --- reads -------------------------------------------------------------------

async function fetchLocation(clientId: string): Promise<ClientGbpLocationRow | null> {
  const { data, error } = await db()
    .from('client_gbp_locations')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw normalizeError(error);
  return (data as ClientGbpLocationRow | null) ?? null;
}

export function useClientGbpLocation(clientId: string | null) {
  return useQuery({
    queryKey: locationKey(clientId),
    queryFn: () => fetchLocation(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

async function fetchReviews(clientId: string): Promise<GbpReviewRow[]> {
  const { data, error } = await db()
    .from('gbp_reviews')
    .select('*')
    .eq('client_id', clientId)
    .is('deleted_at_google', null)
    .order('created_at_google', { ascending: false })
    .limit(100);
  if (error) throw normalizeError(error);
  return (data as GbpReviewRow[] | null) ?? [];
}

export function useClientGbpReviews(clientId: string | null) {
  return useQuery({
    queryKey: reviewsKey(clientId),
    queryFn: () => fetchReviews(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

async function fetchRequests(clientId: string): Promise<GbpReviewRequestRow[]> {
  const { data, error } = await db()
    .from('gbp_review_requests')
    .select('*')
    .eq('client_id', clientId)
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) throw normalizeError(error);
  return (data as GbpReviewRequestRow[] | null) ?? [];
}

export function useClientGbpReviewRequests(clientId: string | null) {
  return useQuery({
    queryKey: requestsKey(clientId),
    queryFn: () => fetchRequests(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

// --- helpers -----------------------------------------------------------------

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out — sign in again.');
  return token;
}

function errorMessage(code: string | undefined, status: number): string {
  switch (code) {
    case 'gbp-not-configured':
      return 'Google Business Profile is not configured — add the GOOGLE_OAUTH_* credentials.';
    case 'list-accounts-failed':
      return 'Could not list Google accounts — try reconnecting the integration.';
    case 'upsert-failed':
      return 'Could not save the location selection.';
    case 'review-not-found':
      return 'That review is no longer available.';
    case 'reply-failed':
      return 'Google rejected the reply — the original review may have been deleted.';
    case 'reply-too-long':
      return 'Reply is too long — keep it under 4096 characters.';
    case 'empty-replyText':
      return 'Reply cannot be empty.';
    case 'no-recipient-channel':
      return 'Enter a phone number or an email address.';
    case 'forbidden':
    case 'forbidden-client':
      return 'You do not have access to this client.';
    case 'unauthenticated':
      return 'You are signed out — sign in again.';
    default:
      return `Something went wrong (${code ?? status}).`;
  }
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const token = await accessToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(errorMessage(json.error as string | undefined, response.status));
  }
  return json;
}

// --- mutations ---------------------------------------------------------------

/** The flattened pick-list returned by the locations 'list' action. */
export type GbpLocationOption = {
  accountName: string;
  locationName: string;
  title: string;
  address: string | null;
  placeId: string | undefined;
};

/** Bucket per account so the picker UI can group locations under their
 *  parent Google account header. */
export type GbpLocationListBucket = {
  account: { name: string; accountName: string };
  locations: GbpLocationOption[];
  error: string | null;
};

export function useListGbpLocations(clientId: string | null) {
  return useMutation({
    mutationFn: async (): Promise<GbpLocationListBucket[]> => {
      if (!clientId) throw new Error('No active client.');
      const result = (await postJson('/api/integrations/google_business_profile/locations', {
        clientId,
        action: 'list',
      })) as { accounts: GbpLocationListBucket[] };
      return result.accounts;
    },
  });
}

export function useSelectGbpLocation(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { accountName: string; locationName: string; title?: string }) => {
      if (!clientId) throw new Error('No active client.');
      return postJson('/api/integrations/google_business_profile/locations', {
        clientId,
        action: 'select',
        accountName: input.accountName,
        locationName: input.locationName,
        title: input.title,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locationKey(clientId) });
      void queryClient.invalidateQueries({ queryKey: reviewsKey(clientId) });
    },
  });
}

export function useSyncGbpReviews(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('No active client.');
      return postJson('/api/integrations/google_business_profile/sync', { clientId });
    },
    onSuccess: () => {
      // The sync runs in the background — invalidate to refetch after the
      // operator's "Sync now" click. There is no instant result here; the
      // refetch picks up whatever the job lands moments later.
      void queryClient.invalidateQueries({ queryKey: locationKey(clientId) });
      void queryClient.invalidateQueries({ queryKey: reviewsKey(clientId) });
    },
  });
}

export function useReplyToGbpReview(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reviewId: string; replyText: string }) => {
      if (!clientId) throw new Error('No active client.');
      return postJson('/api/integrations/google_business_profile/reply', {
        clientId,
        reviewId: input.reviewId,
        replyText: input.replyText,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsKey(clientId) });
    },
  });
}

export function useMarkGbpReviewsSeen(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('No active client.');
      return postJson('/api/integrations/google_business_profile/mark-seen', { clientId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsKey(clientId) });
    },
  });
}

export function useSendGbpReviewRequest(clientId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recipientName?: string;
      recipientPhone?: string;
      recipientEmail?: string;
      leadId?: string;
      bookingId?: string;
    }) => {
      if (!clientId) throw new Error('No active client.');
      return postJson('/api/integrations/google_business_profile/review-request', {
        clientId,
        recipientName: input.recipientName,
        recipientPhone: input.recipientPhone,
        recipientEmail: input.recipientEmail,
        leadId: input.leadId,
        bookingId: input.bookingId,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: requestsKey(clientId) });
    },
  });
}

// --- derived counts ----------------------------------------------------------

/** Cheap count of unseen reviews for a client — drives the operator
 *  dashboard "N new" badge. Returns null while loading so callers can
 *  render a neutral placeholder. */
export function useNewGbpReviewsCount(clientId: string | null): number | null {
  const reviews = useClientGbpReviews(clientId);
  if (!reviews.data) return null;
  return reviews.data.filter((r) => r.is_new_since_last_view).length;
}
