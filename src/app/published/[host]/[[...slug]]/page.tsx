// =============================================================================
// Public-site renderer route — app/published/[host]/[[...slug]].
//
// Reached ONLY via the middleware rewrite (middleware.ts) — a visitor on a
// published client host ({slug}.webnua.dev or a custom domain) has their
// request rewritten here; the URL bar still shows the real host. The `host`
// segment carries that host; the optional `slug` catch-all is the path.
//
// resolveSite() does all the work — host + path → a published website page
// or funnel step. `revalidate = 60` caches rendered pages for a minute.
// =============================================================================

import type { Metadata } from 'next';

import { PublicSiteRenderer } from '@/components/public-site/PublicSiteRenderer';
import { resolveSite, type ResolvedTarget } from '@/lib/public-site/resolve';

export const revalidate = 60;

type RouteParams = { host: string; slug?: string[] };

function pathOf(slug?: string[]): string {
  return (slug ?? []).join('/');
}

// ---- Metadata -------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { host, slug } = await params;
  const target = await resolveSite(decodeURIComponent(host), pathOf(slug));

  if (target.status === 'website') {
    const title = target.page.seo.title || target.page.title || target.siteName;
    return {
      title,
      description: target.page.seo.description,
      icons: target.faviconUrl ? { icon: target.faviconUrl } : undefined,
      openGraph: {
        title,
        description: target.page.seo.description,
        images: target.page.seo.ogImageUrl
          ? [target.page.seo.ogImageUrl]
          : undefined,
      },
    };
  }
  if (target.status === 'funnel') {
    const title = target.step.seo.title || target.step.title || target.siteName;
    return {
      title,
      description: target.step.seo.description,
      icons: target.faviconUrl ? { icon: target.faviconUrl } : undefined,
    };
  }
  return {
    title: target.status === 'unpublished' ? target.name : 'Site not found',
  };
}

// ---- Fallback message -----------------------------------------------------

function SiteMessage({ heading, body }: { heading: string; body: string }) {
  return (
    <main
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f1ea',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#0a0a0a',
            marginBottom: 8,
          }}
        >
          {heading}
        </h1>
        <p style={{ fontSize: 14, color: '#6e685c', lineHeight: 1.6 }}>
          {body}
        </p>
      </div>
    </main>
  );
}

// ---- Page -----------------------------------------------------------------

export default async function PublishedPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { host, slug } = await params;
  const target: ResolvedTarget = await resolveSite(
    decodeURIComponent(host),
    pathOf(slug),
  );

  if (target.status === 'not_found') {
    return (
      <SiteMessage
        heading="Site not found"
        body="There is no published Webnua site at this address."
      />
    );
  }
  if (target.status === 'unpublished') {
    return (
      <SiteMessage
        heading={target.name}
        body="This site hasn’t been published yet. Check back soon."
      />
    );
  }
  if (target.status === 'website') {
    return (
      <PublicSiteRenderer
        kind="website"
        brand={target.brand}
        header={target.header}
        footer={target.footer}
        nav={target.nav}
        pages={target.pages}
        page={target.page}
      />
    );
  }
  return <PublicSiteRenderer kind="funnel" brand={target.brand} step={target.step} />;
}
