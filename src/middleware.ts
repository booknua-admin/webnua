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
// The rewrite is internal — the visitor's URL never changes. The public
// renderer (app/published/[host]/[[...slug]]) resolves {host} to a published
// snapshot. See lib/public-site/resolve.ts.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';

const APP_HOST = (process.env.APP_HOST ?? 'app.webnua.com').toLowerCase();

/** Hosts that should serve the Webnua app, not a published client site. */
function isAppHost(host: string): boolean {
  return (
    host === APP_HOST ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.vercel.app')
  );
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();

  // App / preview / local hosts — render the app as normal.
  if (!host || isAppHost(host)) return NextResponse.next();

  // Any other host is a published client site — rewrite to the renderer.
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
