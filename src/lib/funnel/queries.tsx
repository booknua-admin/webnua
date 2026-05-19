// =============================================================================
// Funnel cluster — data access (Phase 4 · builder family).
//
// Replaces the `lib/funnel/data-stub.tsx` accessors with live Supabase reads
// against `funnels` + `funnel_versions` (seeded by migration 0023). RLS bounds
// the rows: a client sees their own funnels, an operator the clients they can
// access.
//
// The app carries a client *slug* (`voltline`, …); the tables key on the
// client UUID — the queryFns resolve slug → id, and `Funnel.clientId` is kept
// as the slug so brand resolution (`getBrandForClient`, slug-keyed) still
// works for either editor mode.
//
// Funnel *publish/approval* is still unbuilt (CLAUDE.md parked decision) — the
// editor autosaves to a localStorage draft slot; there is no write path here.
// `data-stub.tsx` is retained: the onboarding generation stub still reads it.
//
// queryFn throws `AppError`; a funnel outside the caller's tenant — or a slug
// with no client row — resolves as `not_found`.
// =============================================================================

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import { subscribeBuilder } from '@/lib/website/builder-events';
import { loadDraftsForFunnel } from '@/lib/website/content-drafts';
import type { DomainSSLStatus } from '@/lib/website/types';

import type {
  Funnel,
  FunnelVersion,
  FunnelVersionSnapshot,
} from './types';

// ---- Row shapes -------------------------------------------------------------

type FunnelRow = {
  id: string;
  client_id: string;
  name: string;
  slug: string;
  domain_primary: string;
  domain_aliases: string[];
  domain_ssl_status: DomainSSLStatus;
  draft_version_id: string | null;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type FunnelVersionRow = {
  id: string;
  funnel_id: string;
  status: FunnelVersion['status'];
  snapshot: unknown;
  created_by: string;
  created_at: string;
  published_at: string | null;
  published_by: string | null;
  notes: string | null;
  parent_version_id: string | null;
};

// ---- Mappers ----------------------------------------------------------------

function mapFunnel(row: FunnelRow, clientSlug: string): Funnel {
  return {
    id: row.id,
    clientId: clientSlug,
    name: row.name,
    slug: row.slug,
    domain: {
      primary: row.domain_primary,
      aliases: row.domain_aliases,
      sslStatus: row.domain_ssl_status,
    },
    draftVersionId: row.draft_version_id ?? '',
    publishedVersionId: row.published_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFunnelVersion(row: FunnelVersionRow): FunnelVersion {
  return {
    id: row.id,
    funnelId: row.funnel_id,
    status: row.status,
    snapshot: row.snapshot as FunnelVersionSnapshot,
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
    publishedBy: row.published_by ?? undefined,
    notes: row.notes ?? undefined,
    parentVersionId: row.parent_version_id ?? undefined,
  };
}

// ---- Fetchers ---------------------------------------------------------------

async function resolveClientId(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error) throw normalizeError(error);
  return data.id;
}

async function fetchFunnelsForClient(slug: string): Promise<Funnel[]> {
  const clientId = await resolveClientId(slug);
  const { data, error } = await supabase
    .from('funnels')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) throw normalizeError(error);
  return (data as FunnelRow[]).map((row) => mapFunnel(row, slug));
}

async function fetchAllFunnels(): Promise<Funnel[]> {
  const { data, error } = await supabase
    .from('funnels')
    .select('*, clients!inner(slug)')
    .order('created_at', { ascending: true });
  if (error) throw normalizeError(error);
  return (data as (FunnelRow & { clients: { slug: string } })[]).map((row) =>
    mapFunnel(row, row.clients.slug),
  );
}

export async function fetchFunnelWithDraft(
  funnelId: string,
): Promise<{ funnel: Funnel; draft: FunnelVersion }> {
  const { data: funnelRow, error: funnelError } = await supabase
    .from('funnels')
    .select('*, clients!inner(slug)')
    .eq('id', funnelId)
    .single();
  if (funnelError) throw normalizeError(funnelError);

  const row = funnelRow as FunnelRow & { clients: { slug: string } };
  const funnel = mapFunnel(row, row.clients.slug);

  const { data: versionRow, error: versionError } = await supabase
    .from('funnel_versions')
    .select('*')
    .eq('id', funnel.draftVersionId)
    .single();
  if (versionError) throw normalizeError(versionError);

  const draft = mapFunnelVersion(versionRow as FunnelVersionRow);
  // Overlay the content_drafts autosave buffer onto the draft steps.
  const drafts = await loadDraftsForFunnel(funnelId);
  if (drafts.length > 0) {
    draft.snapshot = {
      ...draft.snapshot,
      steps: draft.snapshot.steps.map((step) => {
        const buffered = drafts.find((d) => d.pageKey === step.id);
        return buffered ? { ...step, sections: buffered.sections } : step;
      }),
    };
  }
  return { funnel, draft };
}

async function fetchFunnelVersions(funnelId: string): Promise<FunnelVersion[]> {
  const { data, error } = await supabase
    .from('funnel_versions')
    .select('*')
    .eq('funnel_id', funnelId)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
  return (data as FunnelVersionRow[]).map(mapFunnelVersion);
}

// ---- Hooks ------------------------------------------------------------------

/** The active workspace's funnels, by client slug. Idle until a slug is set. */
export function useFunnelsForClient(clientSlug: string | null) {
  return useQuery({
    queryKey: ['funnels', 'by-client', clientSlug],
    queryFn: () => fetchFunnelsForClient(clientSlug as string),
    enabled: clientSlug != null && clientSlug.length > 0,
  });
}

/** Every funnel the caller can see — backs the agency-mode cross-client
 *  roster, which groups by `Funnel.clientId` (the slug). */
export function useAllFunnels() {
  return useQuery({
    queryKey: ['funnels', 'all'],
    queryFn: fetchAllFunnels,
  });
}

/** Every version of a funnel, newest first. Backs the detail page's
 *  build-history card. */
export function useFunnelVersions(funnelId: string | null) {
  return useQuery({
    queryKey: ['funnels', 'versions', funnelId],
    queryFn: () => fetchFunnelVersions(funnelId as string),
    enabled: funnelId != null && funnelId.length > 0,
  });
}

/** One funnel + its draft version (the editable model). Backs the funnel
 *  detail page's editor deep-link and the funnel-step editor. */
export function useFunnelWithDraft(funnelId: string | null) {
  const query = useQuery({
    queryKey: ['funnels', 'with-draft', funnelId],
    queryFn: () => fetchFunnelWithDraft(funnelId as string),
    enabled: funnelId != null && funnelId.length > 0,
  });
  const { refetch } = query;
  useEffect(() => subscribeBuilder(() => void refetch()), [refetch]);
  return query;
}
