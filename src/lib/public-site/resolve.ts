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
  tracking_key: string;
};

type FunnelRow = {
  id: string;
  name: string;
  client_id: string;
  slug: string;
  published_version_id: string | null;
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
    if (!website) website = await findWebsiteByClient(clientId);

    // ---- Load the website's published snapshot (if any). ----
    let websiteSnapshot: VersionSnapshot | null = null;
    if (website?.published_version_id) {
      const snap = await snapshotById(
        'website_versions',
        website.published_version_id,
      );
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
        };
      }
    }

    // ---- Funnel: the first path segment as a funnel slug. ----
    if (first) {
      const funnel = await findFunnelBySlug(clientId, first);
      if (funnel) {
        if (!funnel.published_version_id) {
          return { status: 'unpublished', name: funnel.name };
        }
        const snap = await snapshotById(
          'funnel_versions',
          funnel.published_version_id,
        );
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
        };
      }
    }

    // ---- Nothing matched. ----
    if (website && !website.published_version_id && !first) {
      return { status: 'unpublished', name: website.name };
    }
    return { status: 'not_found' };
  },
);
