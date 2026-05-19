// =============================================================================
// Public-site resolution — server-only.
//
// Maps an incoming Host header to a *published* website or funnel snapshot.
// Read with the service-role client (RLS-bypassing); the "published only"
// filtering is enforced here in code.
//
// Resolution order for a host:
//   1. a website whose domain_primary / domain_aliases matches exactly
//      (covers custom domains, e.g. voltline.com.au);
//   2. a funnel matched the same way;
//   3. a website found by treating the host's first label as a client slug
//      ({slug}.webnua.dev → the client's website). This is the zero-config
//      path — every client website is reachable at {slug}.<PUBLIC_SITE_DOMAIN>
//      with no per-site setup.
//
// `resolveSite` is wrapped in React `cache()` so a route's generateMetadata
// and its component share a single resolution per request.
// =============================================================================

import { cache } from 'react';

import type { FunnelVersionSnapshot } from '@/lib/funnel/types';
import { getServiceClient } from '@/lib/supabase/server';
import type {
  BrandObject,
  VersionSnapshot,
  VoiceToneAxis,
} from '@/lib/website/types';

const PUBLIC_SITE_DOMAIN = (
  process.env.PUBLIC_SITE_DOMAIN ?? 'webnua.dev'
).toLowerCase();

export type ResolvedSite =
  | {
      status: 'website';
      name: string;
      brand: BrandObject;
      snapshot: VersionSnapshot;
      faviconUrl: string | null;
    }
  | {
      status: 'funnel';
      name: string;
      brand: BrandObject;
      snapshot: FunnelVersionSnapshot;
      faviconUrl: string | null;
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

type SiteRow = {
  id: string;
  name: string;
  client_id: string;
  published_version_id: string | null;
  domain_primary: string;
  domain_aliases: string[];
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

async function findWebsiteByDomain(host: string): Promise<SiteRow | null> {
  const svc = getServiceClient();
  const byPrimary = await svc
    .from('websites')
    .select('*')
    .eq('domain_primary', host)
    .limit(1);
  if (byPrimary.data?.[0]) return byPrimary.data[0] as unknown as SiteRow;
  const byAlias = await svc
    .from('websites')
    .select('*')
    .contains('domain_aliases', [host])
    .limit(1);
  return (byAlias.data?.[0] as unknown as SiteRow) ?? null;
}

async function findFunnelByDomain(host: string): Promise<SiteRow | null> {
  const svc = getServiceClient();
  const byPrimary = await svc
    .from('funnels')
    .select('*')
    .eq('domain_primary', host)
    .limit(1);
  if (byPrimary.data?.[0]) return byPrimary.data[0] as unknown as SiteRow;
  const byAlias = await svc
    .from('funnels')
    .select('*')
    .contains('domain_aliases', [host])
    .limit(1);
  return (byAlias.data?.[0] as unknown as SiteRow) ?? null;
}

async function websiteForClientSlug(slug: string): Promise<SiteRow | null> {
  const svc = getServiceClient();
  const client = await svc
    .from('clients')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!client.data) return null;
  const clientId = (client.data as unknown as { id: string }).id;
  const site = await svc
    .from('websites')
    .select('*')
    .eq('client_id', clientId)
    .limit(1);
  return (site.data?.[0] as unknown as SiteRow) ?? null;
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

export const resolveSite = cache(
  async (rawHost: string): Promise<ResolvedSite> => {
    const host = normalizeHost(rawHost);
    if (!host) return { status: 'not_found' };

    // 1. Website by exact domain (custom domains + explicit aliases).
    let website = await findWebsiteByDomain(host);

    // 2. Funnel by exact domain — only if no website claimed the host.
    const funnel = website ? null : await findFunnelByDomain(host);

    // 3. Website by subdomain label → client slug (the zero-config path).
    if (!website && !funnel && host.endsWith(`.${PUBLIC_SITE_DOMAIN}`)) {
      const label = host.slice(
        0,
        host.length - PUBLIC_SITE_DOMAIN.length - 1,
      );
      if (label && !label.includes('.')) {
        website = await websiteForClientSlug(label);
      }
    }

    if (website) {
      if (!website.published_version_id) {
        return { status: 'unpublished', name: website.name };
      }
      const snapshot = await snapshotById(
        'website_versions',
        website.published_version_id,
      );
      if (!snapshot) return { status: 'unpublished', name: website.name };
      const brand = await brandForClient(website.client_id);
      return {
        status: 'website',
        name: website.name,
        brand,
        snapshot: snapshot as VersionSnapshot,
        faviconUrl: brand.faviconUrl,
      };
    }

    if (funnel) {
      if (!funnel.published_version_id) {
        return { status: 'unpublished', name: funnel.name };
      }
      const snapshot = await snapshotById(
        'funnel_versions',
        funnel.published_version_id,
      );
      if (!snapshot) return { status: 'unpublished', name: funnel.name };
      const brand = await brandForClient(funnel.client_id);
      return {
        status: 'funnel',
        name: funnel.name,
        brand,
        snapshot: snapshot as FunnelVersionSnapshot,
        faviconUrl: brand.faviconUrl,
      };
    }

    return { status: 'not_found' };
  },
);
