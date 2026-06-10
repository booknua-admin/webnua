'use client';

// =============================================================================
// Social calendar — browser data layer.
//
// RLS-scoped reads + writes against social_posts (migration 0122). Owners
// and operators share the same hooks — the table's policies allow full
// calendar management for accessible clients; only the publish-state flips
// come from the service-role worker. Untyped cast — social_posts isn't in
// the generated Database type yet (same pattern as use-gbp.ts).
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError, normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type { SocialPostRow } from './types';

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'PGRST205';
}

const postsKey = (clientId: string | null) => ['social-posts', clientId] as const;

async function fetchPosts(clientId: string): Promise<SocialPostRow[]> {
  const { data, error } = await db()
    .from('social_posts')
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'dismissed')
    .order('scheduled_for', { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return [];
    throw normalizeError(error);
  }
  return (data as SocialPostRow[] | null) ?? [];
}

/** The client's calendar (everything except dismissed), soonest first.
 *  Polls while a generation is likely in flight — the caller flips
 *  `refetchInterval` on after requesting a draft run. */
export function useSocialPosts(clientId: string | null, polling = false) {
  return useQuery({
    queryKey: postsKey(clientId),
    queryFn: () => fetchPosts(clientId!),
    enabled: !!clientId,
    refetchInterval: polling ? 2500 : false,
  });
}

// --- mutations -----------------------------------------------------------

export type UpdateSocialPostInput = {
  id: string;
  clientId: string;
  caption?: string;
  hashtags?: string;
  scheduledFor?: string;
  imageUrl?: string | null;
  status?: 'draft' | 'approved' | 'dismissed';
};

async function updatePost(input: UpdateSocialPostInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.caption !== undefined) patch.caption = input.caption;
  if (input.hashtags !== undefined) patch.hashtags = input.hashtags;
  if (input.scheduledFor !== undefined) patch.scheduled_for = input.scheduledFor;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;
  if (input.status !== undefined) {
    patch.status = input.status;
    if (input.status === 'approved') {
      patch.approved_at = new Date().toISOString();
      patch.approved_by = user.id;
    }
  }

  const { error } = await db()
    .from('social_posts')
    .update(patch)
    .eq('id', input.id)
    .in('status', ['draft', 'approved', 'failed']);
  if (error) throw normalizeError(error);
}

export function useUpdateSocialPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePost,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: postsKey(variables.clientId) });
    },
  });
}

/** Approve every draft in one tap — "Approve all" for the month. */
async function approveAll(clientId: string): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppError.auth();
  const { data, error } = await db()
    .from('social_posts')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('client_id', clientId)
    .eq('status', 'draft')
    .select('id');
  if (error) throw normalizeError(error);
  return (data as { id: string }[] | null)?.length ?? 0;
}

export function useApproveAllSocialPosts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveAll,
    onSuccess: (_count, clientId) => {
      void queryClient.invalidateQueries({ queryKey: postsKey(clientId) });
    },
  });
}

/** Kick off a 30-day draft run via the jobs spine. */
async function generateCalendar(clientId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw AppError.auth();
  const response = await fetch('/api/social/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = (json.error as string | undefined) ?? `${response.status}`;
    throw new Error(
      code === 'anthropic-not-configured'
        ? 'AI drafting is not configured on this deployment.'
        : `Could not start drafting (${code}).`,
    );
  }
}

export function useGenerateSocialCalendar() {
  return useMutation({ mutationFn: generateCalendar });
}
