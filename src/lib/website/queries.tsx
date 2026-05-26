'use client';

// =============================================================================
// Website builder — data access (Phase 4 · builder family).
//
// Live Supabase reads over websites / website_versions / content_drafts /
// website_approval_submissions / force_publish_audit_log + brands. Replaces
// the localStorage `data-stub` / `publish-stub` / `audit-stub` read paths.
//
// Reactivity: every builder mutation fires `BUILDER_EVENT`; `useBuilderQuery`
// refetches on it, so a publish / approve / autosave anywhere refreshes every
// dependent surface. The three reactive hooks
// (`useWebsitePublishState` / `useUserPendingSubmission` /
// `useAllPendingApprovals`) keep their old return shapes — `use-publish-state`
// re-exports them so consumers are unchanged.
//
// queryFn throws `AppError`; a row outside the caller's tenant resolves as
// `not_found` under RLS.
// =============================================================================

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { normalizeError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';
import type { Json } from '@/lib/types/database';
import type {
  WebsiteApprovalDiff,
  WebsiteApprovalStatus,
  WebsiteApprovalSubmission,
} from '@/lib/tickets/website-approval-stub';
import type { ForcePublishEntry } from '@/lib/auth/audit-stub';

import { subscribeBuilder } from './builder-events';
import { loadDraftsForWebsite } from './content-drafts';
import { mergeGeneratedPages } from './generated-pages-stub';
import { rowToOffer } from './offer-generate';
import { mergeDraftsIntoSnapshot, normalizeSnapshotPageIds } from './snapshot';
import type {
  BrandObject,
  DomainSSLStatus,
  Version,
  VersionSnapshot,
  VersionStatus,
  VoiceToneAxis,
  Website,
} from './types';

// ---- Row shapes -----------------------------------------------------------

type WebsiteRow = {
  id: string;
  client_id: string;
  name: string;
  domain_primary: string;
  domain_aliases: string[];
  domain_ssl_status: DomainSSLStatus;
  draft_version_id: string | null;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  website_id: string;
  status: VersionStatus;
  snapshot: unknown;
  created_by: string;
  created_at: string;
  published_at: string | null;
  published_by: string | null;
  notes: string | null;
  parent_version_id: string | null;
};

type ApprovalRow = {
  id: string;
  website_id: string;
  pending_version_id: string;
  submitter_id: string;
  submitted_at: string;
  status: WebsiteApprovalStatus;
  note: string | null;
  diff: unknown;
  rejection_reason: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  submitter?: { display_name: string } | null;
  resolver?: { display_name: string } | null;
  website?: { name: string; clients: { name: string; slug: string } | null } | null;
};

// ---- Mappers --------------------------------------------------------------

export function mapWebsite(row: WebsiteRow, clientSlug: string): Website {
  return {
    id: row.id,
    clientId: clientSlug,
    name: row.name,
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

export function mapVersion(row: VersionRow): Version {
  return {
    id: row.id,
    websiteId: row.website_id,
    status: row.status,
    snapshot: row.snapshot as VersionSnapshot,
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
    publishedBy: row.published_by ?? undefined,
    notes: row.notes ?? undefined,
    parentVersionId: row.parent_version_id ?? undefined,
  };
}

function mapApproval(row: ApprovalRow): WebsiteApprovalSubmission {
  return {
    id: row.id,
    websiteId: row.website_id,
    pendingVersionId: row.pending_version_id,
    submitterId: row.submitter_id,
    submitterName: row.submitter?.display_name ?? 'A teammate',
    submittedAt: row.submitted_at,
    status: row.status,
    note: row.note ?? undefined,
    diff: row.diff as WebsiteApprovalDiff,
    clientName: row.website?.clients?.name ?? row.website?.name ?? undefined,
    clientSlug: row.website?.clients?.slug ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedByName: row.resolver?.display_name ?? undefined,
  };
}

const APPROVAL_SELECT =
  '*, submitter:users!website_approval_submissions_submitter_id_fkey(display_name), resolver:users!website_approval_submissions_resolved_by_fkey(display_name), website:websites!website_approval_submissions_website_id_fkey(name, clients(name, slug))';

// ---- builder-aware query wrapper ------------------------------------------

function useBuilderQuery<T>(opts: {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
}) {
  const query = useQuery({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn,
    enabled: opts.enabled,
  });
  const { refetch } = query;
  useEffect(() => subscribeBuilder(() => void refetch()), [refetch]);
  return query;
}

// ---- Shared fetch helpers -------------------------------------------------

async function resolveClientId(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error) throw normalizeError(error);
  return data.id;
}

// ---- Website reads --------------------------------------------------------

/** Exported for the conversational signup's visibility probe — same query
 *  the `/website` hub mounts, used to confirm the customer's RLS-bound
 *  read sees the post-generation row before the editor CTA enables. */
export async function fetchWebsiteForClient(slug: string): Promise<Website | null> {
  const clientId = await resolveClientId(slug);
  const { data, error } = await supabase
    .from('websites')
    .select('*')
    .eq('client_id', clientId)
    .limit(1);
  if (error) throw normalizeError(error);
  const row = (data as WebsiteRow[])[0];
  return row ? mapWebsite(row, slug) : null;
}

/** The active workspace's website (by client slug). null = no website yet. */
export function useWebsiteForClient(clientSlug: string | null) {
  return useBuilderQuery({
    queryKey: ['website', 'for-client', clientSlug],
    queryFn: () => fetchWebsiteForClient(clientSlug as string),
    enabled: clientSlug != null && clientSlug.length > 0,
  });
}

async function fetchAllWebsites(): Promise<Website[]> {
  const { data, error } = await supabase
    .from('websites')
    .select('*, clients!inner(slug)')
    .order('created_at', { ascending: true });
  if (error) throw normalizeError(error);
  return (data as (WebsiteRow & { clients: { slug: string } })[]).map((row) =>
    mapWebsite(row, row.clients.slug),
  );
}

/** Every website the caller can see — the cross-client matrix. */
export function useAllWebsites() {
  return useBuilderQuery({
    queryKey: ['website', 'all'],
    queryFn: fetchAllWebsites,
  });
}

// ---- Version reads --------------------------------------------------------

async function fetchWebsiteVersions(websiteId: string): Promise<Version[]> {
  const { data, error } = await supabase
    .from('website_versions')
    .select('*')
    .eq('website_id', websiteId);
  if (error) throw normalizeError(error);
  return (data as VersionRow[]).map(mapVersion);
}

/** All versions for a website — drives the version-history card. */
export function useWebsiteVersions(websiteId: string | null) {
  return useBuilderQuery({
    queryKey: ['website', 'versions', websiteId],
    queryFn: () => fetchWebsiteVersions(websiteId as string),
    enabled: websiteId != null && websiteId.length > 0,
  });
}

async function fetchAllVersions(): Promise<Version[]> {
  const { data, error } = await supabase
    .from('website_versions')
    .select('*');
  if (error) throw normalizeError(error);
  return (data as VersionRow[]).map(mapVersion);
}

/** Every version across every accessible website — the cross-client matrix. */
export function useAllWebsiteVersions() {
  return useBuilderQuery({
    queryKey: ['website', 'versions-all'],
    queryFn: fetchAllVersions,
  });
}

// ---- Effective draft snapshot --------------------------------------------

export type EffectiveDraft = {
  draftVersionId: string;
  snapshot: VersionSnapshot;
};

export async function fetchEffectiveDraft(
  websiteId: string,
): Promise<EffectiveDraft | null> {
  const { data: websiteData, error: websiteError } = await supabase
    .from('websites')
    .select('draft_version_id')
    .eq('id', websiteId)
    .single();
  if (websiteError) throw normalizeError(websiteError);
  const draftVersionId = websiteData.draft_version_id;
  if (!draftVersionId) return null;

  const { data: versionData, error: versionError } = await supabase
    .from('website_versions')
    .select('snapshot')
    .eq('id', draftVersionId)
    .single();
  if (versionError) throw normalizeError(versionError);

  let base = versionData.snapshot as VersionSnapshot;
  // Self-heal: older generated sites gave every page the shared
  // generation_id (a collision that breaks page tabs, the content_drafts
  // buffer, and nav targeting). Re-id once on read and persist.
  const repaired = normalizeSnapshotPageIds(base);
  if (repaired.changed) {
    base = repaired.snapshot;
    await supabase
      .from('website_versions')
      .update({ snapshot: base as unknown as Json })
      .eq('id', draftVersionId);
  }
  const drafts = await loadDraftsForWebsite(websiteId);
  const merged = mergeDraftsIntoSnapshot(base, drafts);
  // Generated pages (the /website/new stub flow) overlay at read time.
  const withGenerated = {
    ...merged,
    pages: mergeGeneratedPages(websiteId, merged.pages),
  };
  return { draftVersionId, snapshot: withGenerated };
}

/** The effective draft snapshot — draft version baseline + content_drafts
 *  overlay + generated-page overlay. Drives the editor + review surface. */
export function useEffectiveDraft(websiteId: string | null) {
  return useBuilderQuery({
    queryKey: ['website', 'draft-snapshot', websiteId],
    queryFn: () => fetchEffectiveDraft(websiteId as string),
    enabled: websiteId != null && websiteId.length > 0,
  });
}

// ---- Brand ----------------------------------------------------------------

async function fetchBrandForClient(slug: string): Promise<BrandObject | null> {
  const clientId = await resolveClientId(slug);
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw normalizeError(error);
  if (!data) return null;
  // brand_colors / heading_font / body_font / heading_color / body_color /
  // background_color landed as optional columns in migration 0088 (brand
  // editor). `offer` jsonb landed in migration 0096 (Session C.5). They
  // surface on BrandObject as optional fields; NULL on the row resolves
  // to `undefined` so existing readers fall back cleanly.
  const row = data as typeof data & {
    brand_colors: string[] | null;
    heading_font: string | null;
    body_font: string | null;
    heading_color: string | null;
    body_color: string | null;
    background_color: string | null;
    design_bundle_id: string | null;
    derived_palette: unknown;
    offer: unknown;
  };
  return {
    accentColor: row.accent_color,
    brandColors:
      row.brand_colors && row.brand_colors.length > 0 ? row.brand_colors : undefined,
    logoUrl: row.logo_url,
    faviconUrl: row.favicon_url,
    voice: {
      formality: row.voice_formality as VoiceToneAxis,
      urgency: row.voice_urgency as VoiceToneAxis,
      technicality: row.voice_technicality as VoiceToneAxis,
    },
    audienceLine: row.audience_line,
    industryCategory: row.industry_category,
    topJobsToBeBooked: row.top_jobs_to_be_booked,
    headingFont: row.heading_font ?? undefined,
    bodyFont: row.body_font ?? undefined,
    headingColor: row.heading_color ?? undefined,
    bodyColor: row.body_color ?? undefined,
    backgroundColor: row.background_color ?? undefined,
    designBundleId: row.design_bundle_id ?? undefined,
    derivedPalette: row.derived_palette ?? undefined,
    // rowToOffer returns null when any field is missing/empty — a partial
    // offer is treated as no offer, so the fallback chain (section copy ??
    // brand.offer ?? null) doesn't surface half a sentence.
    offer: rowToOffer(row.offer),
  };
}

/** A client's brand object (drives the editor preview). */
export function useBrandForClient(clientSlug: string | null) {
  return useBuilderQuery({
    queryKey: ['website', 'brand', clientSlug],
    queryFn: () => fetchBrandForClient(clientSlug as string),
    enabled: clientSlug != null && clientSlug.length > 0,
  });
}

// ---- Force-publish audit log ----------------------------------------------

async function fetchForcePublishLog(): Promise<ForcePublishEntry[]> {
  const { data, error } = await supabase
    .from('force_publish_audit_log')
    .select(
      '*, actor:users!force_publish_audit_log_actor_user_id_fkey(display_name, email), website:websites!force_publish_audit_log_website_id_fkey(name, clients(name))',
    )
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
  type Row = {
    id: string;
    created_at: string;
    reason: string;
    website_id: string;
    new_version_id: string;
    actor: { display_name: string; email: string } | null;
    website: { name: string; clients: { name: string } | null } | null;
  };
  return (data as Row[]).map((r) => ({
    id: r.id,
    at: r.created_at,
    actor: {
      displayName: r.actor?.display_name ?? 'Operator',
      email: r.actor?.email ?? '',
    },
    target: {
      clientName: r.website?.clients?.name ?? r.website?.name ?? 'Website',
      websiteId: r.website_id,
      pageTitle: r.website?.name ?? 'Full website publish',
    },
    reason: r.reason,
    newVersionId: r.new_version_id,
  }));
}

/** The force-publish audit trail (operator-visible). */
export function useForcePublishLog() {
  return useBuilderQuery({
    queryKey: ['website', 'audit'],
    queryFn: fetchForcePublishLog,
  });
}

// ---- Approval review detail -----------------------------------------------

export type ChangedPage = { id: string; title: string };

async function fetchApprovalChangedPages(
  websiteId: string,
  pendingVersionId: string,
): Promise<ChangedPage[]> {
  const { data: pendingRow } = await supabase
    .from('website_versions')
    .select('snapshot')
    .eq('id', pendingVersionId)
    .maybeSingle();
  const pending = pendingRow?.snapshot as VersionSnapshot | undefined;
  if (!pending) return [];

  const { data: websiteRow } = await supabase
    .from('websites')
    .select('published_version_id')
    .eq('id', websiteId)
    .maybeSingle();
  let published: VersionSnapshot | null = null;
  if (websiteRow?.published_version_id) {
    const { data: pubRow } = await supabase
      .from('website_versions')
      .select('snapshot')
      .eq('id', websiteRow.published_version_id)
      .maybeSingle();
    published = (pubRow?.snapshot as VersionSnapshot) ?? null;
  }

  const changed: ChangedPage[] = [];
  for (const page of pending.pages) {
    const prev = published?.pages.find((p) => p.id === page.id);
    const prevJson = prev ? JSON.stringify(prev.sections) : null;
    if (JSON.stringify(page.sections) !== prevJson) {
      changed.push({ id: page.id, title: page.title });
    }
  }
  if (published) {
    if (JSON.stringify(pending.header) !== JSON.stringify(published.header)) {
      changed.push({ id: 'header', title: 'Header' });
    }
    if (JSON.stringify(pending.footer) !== JSON.stringify(published.footer)) {
      changed.push({ id: 'footer', title: 'Footer' });
    }
  }
  return changed;
}

/** Which pages a pending submission actually changed vs the live version —
 *  drives the approval row's "what am I approving" detail + editor deep-link. */
export function useApprovalChangedPages(
  websiteId: string | null,
  pendingVersionId: string | null,
) {
  return useBuilderQuery({
    queryKey: ['website', 'approval-changed', websiteId, pendingVersionId],
    queryFn: () =>
      fetchApprovalChangedPages(
        websiteId as string,
        pendingVersionId as string,
      ),
    enabled: Boolean(websiteId && pendingVersionId),
  });
}

// ---- Reactive publish-state hooks (return bare values) --------------------

export type WebsitePublishState = {
  publishedVersionId: string | null;
  approvalsForWebsite: WebsiteApprovalSubmission[];
  livePendingSubmission: WebsiteApprovalSubmission | null;
};

const EMPTY_PUBLISH_STATE: WebsitePublishState = {
  publishedVersionId: null,
  approvalsForWebsite: [],
  livePendingSubmission: null,
};

async function fetchWebsitePublishState(
  websiteId: string,
): Promise<WebsitePublishState> {
  const { data: websiteData, error: websiteError } = await supabase
    .from('websites')
    .select('published_version_id')
    .eq('id', websiteId)
    .single();
  if (websiteError) throw normalizeError(websiteError);

  const { data, error } = await supabase
    .from('website_approval_submissions')
    .select(APPROVAL_SELECT)
    .eq('website_id', websiteId)
    .order('submitted_at', { ascending: true });
  if (error) throw normalizeError(error);

  const approvalsForWebsite = (data as ApprovalRow[]).map(mapApproval);
  return {
    publishedVersionId: websiteData.published_version_id,
    approvalsForWebsite,
    livePendingSubmission:
      approvalsForWebsite.find((a) => a.status === 'pending') ?? null,
  };
}

/** Per-website publish state. Same return shape as the old stub hook. */
export function useWebsitePublishState(websiteId: string): WebsitePublishState {
  const query = useBuilderQuery({
    queryKey: ['website', 'publish-state', websiteId],
    queryFn: () => fetchWebsitePublishState(websiteId),
    enabled: websiteId.length > 0,
  });
  return query.data ?? EMPTY_PUBLISH_STATE;
}

async function fetchPendingForUser(
  websiteId: string,
  userId: string,
): Promise<WebsiteApprovalSubmission | null> {
  const { data, error } = await supabase
    .from('website_approval_submissions')
    .select(APPROVAL_SELECT)
    .eq('website_id', websiteId)
    .eq('submitter_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw normalizeError(error);
  return data ? mapApproval(data as ApprovalRow) : null;
}

/** The pending submission this user owns on this website, if any. */
export function useUserPendingSubmission(
  websiteId: string | null,
  userId: string | null,
): WebsiteApprovalSubmission | null {
  const enabled = Boolean(websiteId && userId);
  const query = useBuilderQuery({
    queryKey: ['website', 'pending-for-user', websiteId, userId],
    queryFn: () => fetchPendingForUser(websiteId as string, userId as string),
    enabled,
  });
  return query.data ?? null;
}

async function fetchAllPendingApprovals(): Promise<WebsiteApprovalSubmission[]> {
  const { data, error } = await supabase
    .from('website_approval_submissions')
    .select(APPROVAL_SELECT)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });
  if (error) throw normalizeError(error);
  return (data as ApprovalRow[]).map(mapApproval);
}

/** Every pending approval across the workspace (the /tickets queue). */
export function useAllPendingApprovals(): WebsiteApprovalSubmission[] {
  const query = useBuilderQuery({
    queryKey: ['website', 'pending-all'],
    queryFn: fetchAllPendingApprovals,
  });
  return query.data ?? [];
}
