// =============================================================================
// GET /published/{host}/robots.txt — per-site robots policy.
//
// Published sites allow crawling + advertise the sitemap; preview-lifecycle
// sites (and anything unresolvable) disallow everything, matching the
// noindex meta the renderer already injects for previews.
// =============================================================================

import { resolveSite } from '@/lib/public-site/resolve';

export async function GET(
  _request: Request,
  context: { params: Promise<{ host: string }> },
): Promise<Response> {
  const { host } = await context.params;
  const cleanHost = decodeURIComponent(host).toLowerCase();
  const target = await resolveSite(cleanHost, '/');

  const isLiveWebsite = target.status === 'website' && !target.isPreview;
  const isLiveFunnel = target.status === 'funnel' && !target.isPreview;

  const body = isLiveWebsite
    ? `User-agent: *\nAllow: /\n\nSitemap: https://${cleanHost}/sitemap.xml\n`
    : isLiveFunnel
      ? `User-agent: *\nAllow: /\n`
      : `User-agent: *\nDisallow: /\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
