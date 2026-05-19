// =============================================================================
// Public-site renderer route — app/published/[host]/[[...slug]].
//
// Reached ONLY via the middleware rewrite (middleware.ts) — a visitor on a
// published client host ({slug}.webnua.dev or a custom domain) has their
// request rewritten here, the URL bar still shows the real host. The `host`
// segment carries that host; the optional `slug` catch-all is the path.
//
// `revalidate = 60` — published pages are cached and regenerated at most
// once a minute. A publish-triggered revalidation is a later refinement.
// =============================================================================

import type { Metadata } from 'next';

import { PublicSiteRenderer } from '@/components/public-site/PublicSiteRenderer';
import type { FunnelStep, FunnelVersionSnapshot } from '@/lib/funnel/types';
import { resolveSite, type ResolvedSite } from '@/lib/public-site/resolve';
import type { Page, VersionSnapshot } from '@/lib/website/types';

export const revalidate = 60;

type RouteParams = { host: string; slug?: string[] };

// ---- Page / step selection ------------------------------------------------

function pickPage(snapshot: VersionSnapshot, slug?: string[]): Page | null {
  const target = (slug ?? []).join('/');
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
  slug?: string[],
): FunnelStep | null {
  const target = (slug ?? []).join('/');
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

// ---- Metadata -------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { host, slug } = await params;
  const site = await resolveSite(decodeURIComponent(host));

  if (site.status === 'website') {
    const page = pickPage(site.snapshot, slug);
    const title = page?.seo.title || page?.title || site.name;
    return {
      title,
      description: page?.seo.description,
      icons: site.faviconUrl ? { icon: site.faviconUrl } : undefined,
      openGraph: {
        title,
        description: page?.seo.description,
        images: page?.seo.ogImageUrl ? [page.seo.ogImageUrl] : undefined,
      },
    };
  }
  if (site.status === 'funnel') {
    const step = pickStep(site.snapshot, slug);
    const title = step?.seo.title || step?.title || site.name;
    return {
      title,
      description: step?.seo.description,
      icons: site.faviconUrl ? { icon: site.faviconUrl } : undefined,
    };
  }
  return {
    title: site.status === 'unpublished' ? site.name : 'Site not found',
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
  const site: ResolvedSite = await resolveSite(decodeURIComponent(host));

  if (site.status === 'not_found') {
    return (
      <SiteMessage
        heading="Site not found"
        body="There is no published Webnua site at this address."
      />
    );
  }
  if (site.status === 'unpublished') {
    return (
      <SiteMessage
        heading={site.name}
        body="This site hasn’t been published yet. Check back soon."
      />
    );
  }

  if (site.status === 'website') {
    const page = pickPage(site.snapshot, slug);
    if (!page) {
      return (
        <SiteMessage
          heading="Page not found"
          body="This page doesn’t exist on this site."
        />
      );
    }
    return (
      <PublicSiteRenderer
        kind="website"
        brand={site.brand}
        header={site.snapshot.header}
        footer={site.snapshot.footer}
        nav={site.snapshot.nav}
        pages={site.snapshot.pages}
        page={page}
      />
    );
  }

  // funnel
  const step = pickStep(site.snapshot, slug);
  if (!step) {
    return (
      <SiteMessage
        heading="Step not found"
        body="This funnel step doesn’t exist."
      />
    );
  }
  return <PublicSiteRenderer kind="funnel" brand={site.brand} step={step} />;
}
