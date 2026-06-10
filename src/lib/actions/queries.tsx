'use client';

// =============================================================================
// Suggested actions — browser data layer.
//
// The approval-first feed's read + resolve hooks. Reads run RLS-scoped
// (operators see accessible clients, a client sees their own); approve POSTs
// the dispatch route with the caller's bearer token; dismiss is a browser-
// direct status flip (the suggested_actions_update policy covers it).
//
// Untyped cast — suggested_actions (migration 0119) is not in the generated
// Database type yet; same pattern as use-gbp.ts / use-sms.ts.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type { SuggestedActionKind, SuggestedActionRow } from './types';

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** PostgREST schema-cache error when the table isn't applied yet. */
function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'PGRST205';
}

export const SUGGESTED_ACTIONS_KEY = ['suggested-actions'] as const;

export type SuggestedActionsFilter = {
  /** Scope to one client (UUID). Omit/null = every accessible client. */
  clientId?: string | null;
  /** Scope to one source entity (e.g. a lead detail surface). */
  sourceEntityId?: string;
  /** Drop kinds the viewer can't act on (e.g. ads governance is
   *  operator-only, so the client dashboard excludes the ads kinds). */
  excludeKinds?: readonly SuggestedActionKind[];
  limit?: number;
};

async function fetchSuggestedActions(
  filter: SuggestedActionsFilter,
): Promise<SuggestedActionRow[]> {
  let query = db()
    .from('suggested_actions')
    .select('*')
    .eq('status', 'pending')
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('urgency', { ascending: false }) // 'high' < 'normal' alphabetically — see note below
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 30);

  if (filter.clientId) query = query.eq('client_id', filter.clientId);
  if (filter.sourceEntityId) query = query.eq('source_entity_id', filter.sourceEntityId);

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) return [];
    throw normalizeError(error);
  }
  let rows = (data as SuggestedActionRow[] | null) ?? [];
  if (filter.excludeKinds?.length) {
    const excluded = new Set(filter.excludeKinds);
    rows = rows.filter((row) => !excluded.has(row.kind));
  }
  // Postgres text ordering puts 'high' before 'normal' ascending — we asked
  // descending above which inverts it, so re-sort here for clarity: high
  // urgency first, then newest first.
  return rows.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
}

/** The pending action queue, filtered. Realtime (RealtimeProvider) invalidates
 *  this key when a handler drafts a new action or another device resolves one. */
export function useSuggestedActions(filter: SuggestedActionsFilter = {}) {
  return useQuery({
    queryKey: [
      ...SUGGESTED_ACTIONS_KEY,
      filter.clientId ?? 'all',
      filter.sourceEntityId ?? 'any',
      filter.excludeKinds?.join(',') ?? '',
    ],
    queryFn: () => fetchSuggestedActions(filter),
  });
}

// --- resolve mutations ---------------------------------------------------

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out — sign in again.');
  return token;
}

export type ApproveActionInput = {
  id: string;
  /** Edited draft body (the Edit-then-approve path). */
  body?: string;
};

async function approveAction(input: ApproveActionInput): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const response = await fetch(`/api/actions/${input.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input.body ? { body: input.body } : {}),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = (json.error as string | undefined) ?? `${response.status}`;
    const detail = json.detail ? ` (${String(json.detail)})` : '';
    throw new Error(
      code === 'already-resolved'
        ? 'This was already handled on another device.'
        : code === 'expired'
          ? 'This suggestion expired — a fresh one will appear if it still matters.'
          : `Could not complete that — ${code}${detail}`,
    );
  }
  return json;
}

/** Approve + dispatch a suggested action (sends the reply / applies the ads
 *  change). Invalidates the feed + the lead queries so surfaces reflow. */
export function useApproveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: approveAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUGGESTED_ACTIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

async function dismissAction(id: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await db()
    .from('suggested_actions')
    .update({
      status: 'dismissed',
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw normalizeError(error);
}

/** Dismiss a card — browser-direct status flip under RLS. */
export function useDismissAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dismissAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SUGGESTED_ACTIONS_KEY });
    },
  });
}
