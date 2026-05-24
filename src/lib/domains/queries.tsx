'use client';

// =============================================================================
// Custom-domain UI data layer — Phase 9.
//
// Reads via the RLS-scoped browser client (the table is not yet in the
// generated Database type — same untyped-cast pattern as the per-tenant
// integration hooks). Mutations POST the operator/client API routes under
// /api/domains/*.
// =============================================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

import type { CustomDomainRow } from './types';

function db(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('You are signed out — sign in again.');
  return token;
}

const clientDomainsKey = (clientId: string | null) =>
  ['custom-domains', 'client', clientId] as const;
const allDomainsKey = () => ['custom-domains', 'all'] as const;
const domainKey = (id: string) => ['custom-domains', 'one', id] as const;

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === 'PGRST205';
}

// --- reads -------------------------------------------------------------------

async function fetchDomainsForClient(clientId: string): Promise<CustomDomainRow[]> {
  const { data, error } = await db()
    .from('client_custom_domains')
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'removed')
    .order('is_primary', { ascending: false })
    .order('added_at', { ascending: false });
  if (error && !isMissingTableError(error)) throw normalizeError(error);
  return (data as CustomDomainRow[] | null) ?? [];
}

export function useClientDomains(clientId: string | null) {
  return useQuery({
    queryKey: clientDomainsKey(clientId),
    queryFn: () => fetchDomainsForClient(clientId as string),
    enabled: clientId != null && clientId.length > 0,
  });
}

async function fetchAllDomains(): Promise<CustomDomainRow[]> {
  // RLS scopes to accessible clients automatically — operator sees all
  // accessible-client rows; clients only ever see their own.
  const { data, error } = await db()
    .from('client_custom_domains')
    .select('*')
    .neq('status', 'removed')
    .order('added_at', { ascending: false });
  if (error && !isMissingTableError(error)) throw normalizeError(error);
  return (data as CustomDomainRow[] | null) ?? [];
}

/** Cross-client domains view — agency-mode operator surface. */
export function useAllDomains() {
  return useQuery({
    queryKey: allDomainsKey(),
    queryFn: fetchAllDomains,
  });
}

async function fetchDomainById(id: string): Promise<CustomDomainRow | null> {
  const { data, error } = await db()
    .from('client_custom_domains')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error && !isMissingTableError(error)) throw normalizeError(error);
  return (data as CustomDomainRow | null) ?? null;
}

export function useDomain(id: string | null) {
  return useQuery({
    queryKey: id ? domainKey(id) : (['custom-domains', 'one', 'none'] as const),
    queryFn: () => fetchDomainById(id as string),
    enabled: id != null && id.length > 0,
  });
}

// --- mutations ---------------------------------------------------------------

async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error === 'string' && json.error) ||
      `Request failed (${response.status})`;
    const err = new Error(message) as Error & { code?: string; status?: number };
    err.code = typeof json.error === 'string' ? json.error : undefined;
    err.status = response.status;
    throw err;
  }
  return json;
}

async function deleteJson(path: string): Promise<Record<string, unknown>> {
  const token = await accessToken();
  const response = await fetch(path, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (typeof json.message === 'string' && json.message) ||
      (typeof json.error === 'string' && json.error) ||
      `Request failed (${response.status})`;
    const err = new Error(message) as Error & { code?: string; status?: number };
    err.code = typeof json.error === 'string' ? json.error : undefined;
    err.status = response.status;
    throw err;
  }
  return json;
}

function invalidateScoped(
  qc: ReturnType<typeof useQueryClient>,
  clientId: string | undefined,
): void {
  if (clientId) qc.invalidateQueries({ queryKey: clientDomainsKey(clientId) });
  qc.invalidateQueries({ queryKey: allDomainsKey() });
}

export function useAttachDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; domain: string }) => {
      // Route discriminates on snake_case client_id; keep camelCase at the
      // call site (TS convention) and translate at the wire boundary.
      return (await postJson('/api/domains', {
        client_id: input.clientId,
        domain: input.domain,
      })) as { row: CustomDomainRow };
    },
    onSuccess: (_data, vars) => invalidateScoped(qc, vars.clientId),
  });
}

export function useCheckDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { domainId: string }) => {
      return (await postJson(`/api/domains/${input.domainId}/check`, {})) as {
        row: CustomDomainRow;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: domainKey(data.row.id) });
      invalidateScoped(qc, data.row.client_id);
    },
  });
}

export function useSetPrimaryDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { domainId: string }) => {
      return (await postJson(`/api/domains/${input.domainId}/set-primary`, {})) as {
        row: CustomDomainRow;
      };
    },
    onSuccess: (data) => invalidateScoped(qc, data.row.client_id),
  });
}

export function useRemoveDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { domainId: string; clientId: string }) => {
      await deleteJson(`/api/domains/${input.domainId}`);
      return input;
    },
    onSuccess: (vars) => invalidateScoped(qc, vars.clientId),
  });
}
