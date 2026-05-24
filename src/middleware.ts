// =============================================================================
// Host-based routing — splits the app from published client sites.
//
// One Vercel deployment serves two things:
//   • the Webnua app itself, on the app host (app.webnua.com) + Vercel
//     preview URLs + localhost — these pass straight through;
//   • every published client website / funnel, on any other host
//     ({slug}.webnua.dev wildcard, or a client's own custom domain) —
//     these are rewritten to the public renderer at /published/{host}/...
//
// Phase 9 — when a request lands on the `{slug}.webnua.dev` subdomain AND
// the client has a primary live custom domain attached, the middleware
// 301-redirects to the custom host instead of rewriting. Consolidates SEO
// on the canonical host. The lookup is async + DB-backed; results are cached
// in memory per edge instance for 60s so the lookup cost is paid at most
// once per host per minute. Lookup errors fall through to the existing
// rewrite (the published renderer still serves the visitor honestly).
//
// The rewrite is internal — the visitor's URL never changes. The public
// renderer (app/published/[host]/[[...slug]]) resolves {host} to a published
// snapshot. See lib/public-site/resolve.ts.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';

const APP_HOST = (process.env.APP_HOST ?? 'app.webnua.com').toLowerCase();
const PUBLIC_SITE_DOMAIN = (process.env.PUBLIC_SITE_DOMAIN ?? 'webnua.dev').toLowerCase();

/** Hosts that should serve the Webnua app, not a published client site. */
function isAppHost(host: string): boolean {
  return (
    host === APP_HOST ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.vercel.app')
  );
}

/** True for `{label}.webnua.dev` where `label` is a single component (one
 *  level deep — the wildcard cert covers exactly one label). */
function isWebnuaSubdomain(host: string): string | null {
  if (!host.endsWith(`.${PUBLIC_SITE_DOMAIN}`)) return null;
  const label = host.slice(0, host.length - PUBLIC_SITE_DOMAIN.length - 1);
  if (!label || label.includes('.')) return null;
  return label;
}

// In-memory cache of subdomain → primary-custom-domain. 60s TTL keeps DB
// pressure to ~1 query per host per minute (the cache is per-edge-instance,
// so multi-region misses pay separately — still negligible at platform
// scale). A successful "no primary" result is cached as `null` to avoid
// re-querying on every page view.
type PrimaryDomainCacheEntry = { value: string | null; expiresAt: number };
const primaryDomainCache = new Map<string, PrimaryDomainCacheEntry>();
const PRIMARY_DOMAIN_CACHE_TTL_MS = 60_000;

/** Look up the primary custom domain for a `{label}.webnua.dev` host. Calls
 *  Supabase via REST (the middleware runs on the edge — the standard
 *  service-role client can't run here). Returns null on any failure / no
 *  primary set. */
async function lookupPrimaryDomain(slug: string): Promise<string | null> {
  const cached = primaryDomainCache.get(slug);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  try {
    // Two-query lookup via PostgREST: slug → client_id → primary domain.
    const clientResp = await fetch(
      `${url}/rest/v1/clients?slug=eq.${encodeURIComponent(slug)}&select=id`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        // Short timeout to avoid making middleware feel slow on a DB hiccup.
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!clientResp.ok) {
      primaryDomainCache.set(slug, { value: null, expiresAt: now + PRIMARY_DOMAIN_CACHE_TTL_MS });
      return null;
    }
    const clients = (await clientResp.json()) as { id?: string }[];
    const clientId = clients[0]?.id;
    if (!clientId) {
      primaryDomainCache.set(slug, { value: null, expiresAt: now + PRIMARY_DOMAIN_CACHE_TTL_MS });
      return null;
    }
    const domainResp = await fetch(
      `${url}/rest/v1/client_custom_domains?client_id=eq.${encodeURIComponent(
        clientId,
      )}&is_primary=eq.true&status=eq.live&select=domain&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (!domainResp.ok) {
      primaryDomainCache.set(slug, { value: null, expiresAt: now + PRIMARY_DOMAIN_CACHE_TTL_MS });
      return null;
    }
    const rows = (await domainResp.json()) as { domain?: string }[];
    const primary = rows[0]?.domain ?? null;
    primaryDomainCache.set(slug, {
      value: primary,
      expiresAt: now + PRIMARY_DOMAIN_CACHE_TTL_MS,
    });
    return primary;
  } catch {
    // Cache the negative briefly so a Supabase outage doesn't fan out into
    // a per-request stampede.
    primaryDomainCache.set(slug, { value: null, expiresAt: now + 5_000 });
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();

  // App / preview / local hosts — render the app as normal.
  if (!host || isAppHost(host)) return NextResponse.next();

  // {slug}.webnua.dev → if a primary custom domain is wired up, 301 to it.
  const slug = isWebnuaSubdomain(host);
  if (slug) {
    const primary = await lookupPrimaryDomain(slug);
    if (primary && primary !== host) {
      const target = new URL(req.url);
      target.host = primary;
      // Preserve port if local dev points at a non-standard one — in prod the
      // URL constructor strips the default port. Safe in either case.
      return NextResponse.redirect(target.toString(), 301);
    }
  }

  // Any other host (or a Webnua subdomain without a primary) is a published
  // client site — rewrite to the renderer.
  const url = req.nextUrl.clone();
  const path = url.pathname === '/' ? '' : url.pathname;
  url.pathname = `/published/${host}${path}`;
  return NextResponse.rewrite(url);
}

// Skip Next internals, the API, and well-known static files — those must be
// served as-is on every host (including published client sites).
export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
