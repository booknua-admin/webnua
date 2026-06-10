// =============================================================================
// GET /published/{host}/sitemap.xml — per-site sitemap for published sites.
//
// The middleware rewrites every public-host request here, so a visitor (or
// crawler) requesting https://customer.com/sitemap.xml lands on this route
// with the host param. Static segments beat the [[...slug]] catch-all, so
// the page renderer never sees the path. Preview-lifecycle sites return 404
// (they're noindexed — a sitemap would contradict that).
// =============================================================================

import { resolveSite } from '@/lib/public-site/resolve';

export async function GET(
  _request: Request,
  context: { params: Promise<{ host: string }> },
): Promise<Response> {
  const { host } = await context.params;
  const target = await resolveSite(decodeURIComponent(host), '/');

  if (target.status !== 'website' || target.isPreview) {
    return new Response('Not found', { status: 404 });
  }

  const cleanHost = decodeURIComponent(host).toLowerCase();
  const urls = target.pages
    .filter((page) => page.sections.some((s) => s.enabled))
    .map((page) => {
      const path = page.slug === 'home' ? '/' : `/${page.slug}`;
      return `  <url><loc>https://${cleanHost}${path}</loc></url>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
