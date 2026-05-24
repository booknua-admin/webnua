// =============================================================================
// Public-site resolution — server-only.
//
// Maps an incoming Host + path to a *published* render target. Read with the
// service-role client (RLS-bypassing); the "published only" filtering is
// enforced here in code.
//
// Routing model:
//   • A website lives on the client's host — {slug}.webnua.dev (or a custom
//     domain). Pages render at /, /about, …
//   • A funnel lives at a PATH on that same host — {host}/{funnelSlug}. There
//     is no funnel subdomain (a `*.webnua.dev` wildcard cert covers only one
//     label, so book.{client}.webnua.dev could never get a cert).
//
// Resolution is page-first: a path segment that matches a published website
// page renders that page; otherwise the first segment is tried as a funnel
// slug. So a website's own pages are never shadowed by a funnel.
//
// `resolveSite(host, path)` takes primitive args so React `cache()` dedupes
// the call between a route's generateMetadata and its component.
// =============================================================================

import { cache } from 'react';

import {
  publicSiteIsPreview,
  publicSiteIsServable,
} from '@/lib/auth/lifecycle';
import type { FunnelStep, FunnelVersionSnapshot } from '@/lib/funnel/types';
import { getServiceClient } from '@/lib/supabase/server';
import type {
  BrandObject,
  NavLink,
  Page,
  Section,
  VersionSnapshot,
  VoiceToneAxis,
} from '@/lib/website/types';

const PUBLIC_SITE_DOMAIN = (
  process.env.PUBLIC_SITE_DOMAIN ?? 'webnua.dev'
).toLowerCase();

/** Per-surface visitor-tracking config threaded to the public renderer so it
 *  can inject webnua-track.js (visitor-tracking-design.md §4). */
export type TrackingConfig = {
  trackingKey: string;
  surfaceId: string;
  surfaceKind: 'website' | 'funnel';
  pageRef: string;
  consentMode: 'banner' | 'implied';
};

export type ResolvedTarget =
  | {
      status: 'website';
      clientId: string;
      siteName: string;
      brand: BrandObject;
      faviconUrl: string | null;
      header: Section;
      footer: Section;
      nav: NavLink[];
      pages: Page[];
      page: Page;
      tracking: TrackingConfig;
      /** Pattern B preview gating — true when the client is in 'preview'
       *  lifecycle state. The renderer injects a watermark banner +
       *  `noindex,nofollow` + disables form submission so the site is
       *  visible but cannot capture real leads. The data is the same
       *  published snapshot; this flag is the visual + behavioural diff. */
      isPreview: boolean;
    }
  | {
      status: 'funnel';
      clientId: string;
      siteName: string;
      brand: BrandObject;
      faviconUrl: string | null;
      step: FunnelStep;
      /** Path to the next funnel step (for `afterSubmit: nextStep`), or null
       *  on the last step. */
      nextStepHref: string | null;
      tracking: TrackingConfig;
      /** Same semantics as the website case above. */
      isPreview: boolean;
    }
  | { status: 'unpublished'; name: string }
  | { status: 'not_found' };

/** Used when a site has no brand row — keeps the renderer from crashing. */
const FALLBACK_BRAND: BrandObject = {
  accentColor: '#d24317',
  brandColors: ['#d24317'],
  logoUrl: null,
  faviconUrl: null,
  voice: { formality: 3, urgency: 2, technicality: 2 },
  audienceLine: '',
  industryCategory: '',
  topJobsToBeBooked: [],
};

type WebsiteRow = {
  id: string;
  name: string;
  client_id: string;
  published_version_id: string | null;
  /** Pattern B preview rendering reads the draft snapshot when no published
   *  one exists — the wizard's output BEFORE the user clicks Publish. */
  draft_version_id: string | null;
  tracking_key: string;
};

type FunnelRow = {
  id: string;
  name: string;
  client_id: string;
  slug: string;
  published_version_id: string | null;
  draft_version_id: string | null;
  tracking_key: string;
};

function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().split(':')[0];
}

async function brandForClient(clientId: string): Promise<BrandObject> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('brands')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (!data) return FALLBACK_BRAND;
  const row = data as unknown as {
    accent_color: string;
    logo_url: string | null;
    favicon_url: string | null;
    voice_formality: number;
    voice_urgency: number;
    voice_technicality: number;
    audience_line: string;
    industry_category: string;
    top_jobs_to_be_booked: string[];
  };
  return {
    accentColor: row.accent_color,
    brandColors: [row.accent_color],
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
  };
}

async function findWebsiteByDomain(host: string): Promise<WebsiteRow | null> {
  const svc = getServiceClient();
  // Phase 9 — `client_custom_domains` is the new (multi-domain, status-
  // tracked) source. The legacy `websites.domain_primary` + `domain_aliases`
  // remain authoritative for any rows created before Phase 9 OR by the
  // legacy single-domain ConnectDomainButton flow on /website. Both are
  // checked. Order: new table first (the canonical Phase 9 path), then
  // legacy columns. The new table isn't in the generated Database type yet,
  // hence the unknown cast (same pattern as the per-tenant integration
  // hooks).
  const untyped = svc as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: unknown) => {
          eq: (k: string, v: unknown) => {
            maybeSingle: () => Promise<{ data: { client_id: string } | null }>;
          };
        };
      };
    };
  };
  const byCustom = await untyped
    .from('client_custom_domains')
    .select('client_id')
    .eq('domain', host)
    .eq('status', 'live')
    .maybeSingle();
  if (byCustom.data) {
    const clientId = byCustom.data.client_id;
    const website = await findWebsiteByClient(clientId);
    if (website) return website;
  }
  const byPrimary = await svc
    .from('websites')
    .select('*')
    .eq('domain_primary', host)
    .limit(1);
  if (byPrimary.data?.[0]) return byPrimary.data[0] as unknown as WebsiteRow;
  const byAlias = await svc
    .from('websites')
    .select('*')
    .contains('domain_aliases', [host])
    .limit(1);
  return (byAlias.data?.[0] as unknown as WebsiteRow) ?? null;
}

/** Phase 9 — the live primary domain a client has set, used by middleware to
 *  301-redirect requests on the `.webnua.dev` host to the custom host for
 *  SEO consolidation. Returns null when no primary live custom domain exists.
 */
async function findPrimaryDomainForClient(clientId: string): Promise<string | null> {
  const svc = getServiceClient();
  const untyped = svc as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: unknown) => {
          eq: (k: string, v: unknown) => {
            eq: (k: string, v: unknown) => {
              maybeSingle: () => Promise<{ data: { domain: string } | null }>;
            };
          };
        };
      };
    };
  };
  const { data } = await untyped
    .from('client_custom_domains')
    .select('domain')
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .eq('status', 'live')
    .maybeSingle();
  return data ? data.domain : null;
}

export { findPrimaryDomainForClient };

async function findWebsiteByClient(clientId: string): Promise<WebsiteRow | null> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('websites')
    .select('*')
    .eq('client_id', clientId)
    .limit(1);
  return (data?.[0] as unknown as WebsiteRow) ?? null;
}

async function clientIdBySlug(slug: string): Promise<string | null> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return data ? (data as unknown as { id: string }).id : null;
}

/** Read the client's lifecycle_status — drives Pattern B preview gating.
 *  Returns null when the client row is missing. */
async function clientLifecycle(clientId: string): Promise<string | null> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('clients')
    .select('lifecycle_status')
    .eq('id', clientId)
    .maybeSingle();
  return data ? (data as unknown as { lifecycle_status: string }).lifecycle_status : null;
}

/** The client's visitor-tracking consent posture. Defaults to `banner`. */
async function consentModeForClient(
  clientId: string,
): Promise<'banner' | 'implied'> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('clients')
    .select('tracking_consent_mode')
    .eq('id', clientId)
    .maybeSingle();
  return data?.tracking_consent_mode === 'implied' ? 'implied' : 'banner';
}

async function findFunnelBySlug(
  clientId: string,
  slug: string,
): Promise<FunnelRow | null> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('funnels')
    .select('*')
    .eq('client_id', clientId)
    .eq('slug', slug)
    .maybeSingle();
  return data ? (data as unknown as FunnelRow) : null;
}

async function snapshotById(
  table: 'website_versions' | 'funnel_versions',
  versionId: string,
): Promise<unknown | null> {
  const svc = getServiceClient();
  if (table === 'website_versions') {
    const { data } = await svc
      .from('website_versions')
      .select('snapshot')
      .eq('id', versionId)
      .maybeSingle();
    return data ? (data as unknown as { snapshot: unknown }).snapshot : null;
  }
  const { data } = await svc
    .from('funnel_versions')
    .select('snapshot')
    .eq('id', versionId)
    .maybeSingle();
  return data ? (data as unknown as { snapshot: unknown }).snapshot : null;
}

function pickPage(snapshot: VersionSnapshot, segments: string[]): Page | null {
  const target = segments.join('/');
  if (!target || target === 'home') {
    const home = snapshot.pages.find((p) => p.slug === 'home');
    if (home) return home;
    const firstId = snapshot.pageOrder[0];
    return (
      snapshot.pages.find((p) => p.id === firstId) ??
      snapshot.pages[0] ??
      null
    );
  }
  return snapshot.pages.find((p) => p.slug === target) ?? null;
}

function pickStep(
  snapshot: FunnelVersionSnapshot,
  stepSegments: string[],
): FunnelStep | null {
  const target = stepSegments.join('/');
  if (!target) {
    const firstId = snapshot.stepOrder[0];
    return (
      snapshot.steps.find((s) => s.id === firstId) ??
      snapshot.steps[0] ??
      null
    );
  }
  return snapshot.steps.find((s) => s.slug === target) ?? null;
}

export const resolveSite = cache(
  async (rawHost: string, rawPath: string): Promise<ResolvedTarget> => {
    const host = normalizeHost(rawHost);
    if (!host) return { status: 'not_found' };
    const segments = rawPath.split('/').filter(Boolean);
    const first = segments[0] ?? null;

    // ---- Determine the client (+ optional website) from the host. ----
    let website = await findWebsiteByDomain(host);
    let clientId: string | null = website?.client_id ?? null;
    if (!clientId && host.endsWith(`.${PUBLIC_SITE_DOMAIN}`)) {
      const label = host.slice(0, host.length - PUBLIC_SITE_DOMAIN.length - 1);
      if (label && !label.includes('.')) {
        clientId = await clientIdBySlug(label);
      }
    }
    if (!clientId) return { status: 'not_found' };

    // ---- Pattern B lifecycle gating ----
    //
    // Read the client's lifecycle_status to decide whether to serve at all,
    // and (if serving) whether to flag the render as preview. The gates:
    //   • pending_verification / banned / churned → 404 (no public surface)
    //   • preview / onboarding → serve with isPreview=true (watermark + noindex
    //     + disabled forms)
    //   • active / live / paused → serve normally (isPreview=false)
    // Returns 'not_found' rather than 'unpublished' for the not-servable
    // states because there is no useful "your site is at … but not live yet"
    // message we can render — those states predate site generation.
    const lifecycle = await clientLifecycle(clientId);
    if (!lifecycle || !publicSiteIsServable(lifecycle)) {
      return { status: 'not_found' };
    }
    const isPreview = publicSiteIsPreview(lifecycle);

    if (!website) website = await findWebsiteByClient(clientId);

    // ---- Load the website snapshot ----
    //
    // Active/paused: published_version_id (only). Preview: published if
    // published, else draft. The draft fallback is what makes the preview
    // surface USEFUL — a customer mid-wizard has generated a site (a draft
    // version exists) but has not clicked Publish (no published version
    // yet). Without the fallback, preview would show "not found".
    let websiteSnapshot: VersionSnapshot | null = null;
    const websiteVersionId =
      website?.published_version_id ??
      (isPreview ? website?.draft_version_id ?? null : null);
    if (websiteVersionId) {
      const snap = await snapshotById('website_versions', websiteVersionId);
      if (snap) websiteSnapshot = snap as VersionSnapshot;
    }

    // ---- Page-first: a path that matches a website page wins. ----
    if (websiteSnapshot && website) {
      const page = pickPage(websiteSnapshot, segments);
      if (page) {
        const brand = await brandForClient(clientId);
        const consentMode = await consentModeForClient(clientId);
        return {
          status: 'website',
          clientId,
          siteName: website.name ?? page.title,
          brand,
          faviconUrl: brand.faviconUrl,
          header: websiteSnapshot.header,
          footer: websiteSnapshot.footer,
          nav: websiteSnapshot.nav,
          pages: websiteSnapshot.pages,
          page,
          tracking: {
            trackingKey: website.tracking_key,
            surfaceId: website.id,
            surfaceKind: 'website',
            pageRef: page.slug,
            consentMode,
          },
          isPreview,
        };
      }
    }

    // ---- Funnel: the first path segment as a funnel slug. ----
    if (first) {
      const funnel = await findFunnelBySlug(clientId, first);
      if (funnel) {
        // Preview falls back to draft, same shape as website above.
        const funnelVersionId =
          funnel.published_version_id ?? (isPreview ? funnel.draft_version_id : null);
        if (!funnelVersionId) {
          return { status: 'unpublished', name: funnel.name };
        }
        const snap = await snapshotById('funnel_versions', funnelVersionId);
        if (!snap) return { status: 'unpublished', name: funnel.name };
        const funnelSnapshot = snap as FunnelVersionSnapshot;
        const step = pickStep(funnelSnapshot, segments.slice(1));
        if (!step) return { status: 'not_found' };
        const brand = await brandForClient(clientId);
        const consentMode = await consentModeForClient(clientId);
        // Where an `afterSubmit: nextStep` form on this step advances to.
        const order =
          funnelSnapshot.stepOrder.length > 0
            ? funnelSnapshot.stepOrder
            : funnelSnapshot.steps.map((s) => s.id);
        const idx = order.indexOf(step.id);
        let nextStepHref: string | null = null;
        if (idx >= 0 && idx < order.length - 1) {
          const next = funnelSnapshot.steps.find((s) => s.id === order[idx + 1]);
          if (next) nextStepHref = `/${first}/${next.slug}`;
        }
        return {
          status: 'funnel',
          clientId,
          siteName: funnel.name,
          brand,
          faviconUrl: brand.faviconUrl,
          step,
          nextStepHref,
          tracking: {
            trackingKey: funnel.tracking_key,
            surfaceId: funnel.id,
            surfaceKind: 'funnel',
            pageRef: step.slug,
            consentMode,
          },
          isPreview,
        };
      }
    }

    // ---- Nothing matched. ----
    if (website && !website.published_version_id && !website.draft_version_id && !first) {
      return { status: 'unpublished', name: website.name };
    }
    return { status: 'not_found' };
  },
);
