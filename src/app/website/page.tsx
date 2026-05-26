'use client';

// =============================================================================
// /website — workspace-scoped website hub.
//
//   client role        → their workspace's website (resolved from user.clientId)
//   admin agency mode  → empty state pointing to the picker
//   admin sub-account  → that client's website hub
//   admin/client with no website yet → "no website yet" empty state
//
// The hub surfaces:
//   - Header + Footer cards (website-level singletons, design doc §2.5)
//     each linking into the singleton editor at /website/header or /footer
//   - Page grid for the website's Pages (Home / About / Services / Contact)
//   - Nav summary card (capped at MAX_NAV_LINKS = 6 V1)
//   - Version history card (rust LIVE pill on the live version)
// =============================================================================

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { DomainStatusIndicator } from '@/components/shared/website/DomainStatusIndicator';
import { ManagePagesPanel } from '@/components/shared/website/ManagePagesPanel';
import { NewPageEntry } from '@/components/shared/website/NewPageEntry';
import { OpenRequestsCard } from '@/components/shared/website/OpenRequestsCard';
import { PageGridCard } from '@/components/shared/website/PageGridCard';
import { ScaffoldWebsiteButton } from '@/components/shared/website/ScaffoldWebsiteButton';
import { SingletonStrip } from '@/components/shared/website/SingletonStrip';
import { VersionHistoryCard } from '@/components/shared/website/VersionHistoryCard';
import { WebsiteActivityCard } from '@/components/shared/website/WebsiteActivityCard';
import { WebsiteEngagementCard } from '@/components/shared/website/WebsiteEngagementCard';
import { WebsiteHero } from '@/components/shared/website/WebsiteHero';
import { fetchPageTotalsByRef } from '@/lib/analytics/queries';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { getClientUuidBySlug, useAdminClients } from '@/lib/clients/clients-store';
import { renamePages } from '@/lib/website/mutations';
import { useEffectiveDraft, useWebsiteForClient, useWebsiteVersions } from '@/lib/website/queries';
import { type Page, type Version, type Website } from '@/lib/website/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function WebsiteHubPage() {
  const user = useUser();
  const workspace = useWorkspace();

  const activeClientId = user
    ? user.role === 'client'
      ? user.clientId
      : workspace.activeClientId
    : null;

  const websiteQuery = useWebsiteForClient(activeClientId);

  if (!workspace.hydrated || !user) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
        <div className="px-4 py-6 md:px-10 md:py-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Resolving workspace…'}
          </p>
        </div>
      </>
    );
  }

  if (user.role === 'admin' && !activeClientId) {
    return <AgencyEmptyState />;
  }

  if (!activeClientId) {
    return <NoWebsiteState reason="missing-client-membership" />;
  }

  if (websiteQuery.isLoading) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
        <div className="px-4 py-6 md:px-10 md:py-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Loading website…'}
          </p>
        </div>
      </>
    );
  }

  const website = websiteQuery.data ?? null;
  if (!website) {
    return (
      <NoWebsiteState
        reason="no-website-yet"
        clientId={activeClientId}
        viewerRole={user.role}
        refetch={() => void websiteQuery.refetch()}
      />
    );
  }

  return <WebsiteHub website={website} />;
}

// -- Connected website hub (the happy path) --------------------------------

function WebsiteHub({ website }: { website: Website }) {
  const user = useUser();
  const draftQuery = useEffectiveDraft(website.id);
  const versionsQuery = useWebsiteVersions(website.id);
  // 30-day per-page totals for the page grid cards; the surface-level
  // engagement card fetches its own 7-day window separately.
  const pageTotalsQuery = useQuery({
    queryKey: ['analytics', 'page-totals', website.id],
    queryFn: () => fetchPageTotalsByRef(website.id, 30),
  });
  const [pagesPanelOpen, setPagesPanelOpen] = useState(false);

  if (draftQuery.isLoading || versionsQuery.isLoading) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
        <div className="px-4 py-6 md:px-10 md:py-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Loading website…'}
          </p>
        </div>
      </>
    );
  }

  if (!draftQuery.data) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
        <div className="px-4 py-6 md:px-10 md:py-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn">
            No draft version on this website.
          </p>
        </div>
      </>
    );
  }

  const snapshot = draftQuery.data.snapshot;
  // useEffectiveDraft already merges the content_drafts + generated-page
  // overlays into the snapshot pages.
  const pages = snapshot.pages;
  const publishedVersion =
    (versionsQuery.data ?? []).find((v) => v.id === website.publishedVersionId) ?? null;

  const history: Version[] = (versionsQuery.data ?? []).slice().sort((a, b) => {
    const order: Record<Version['status'], number> = {
      published: 0,
      pending_approval: 1,
      draft: 2,
      archived: 3,
    };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);
  });

  const isLive = !!website.publishedVersionId;
  // Resolve "BY YOU / BY WEBNUA" for each page by looking up the most-recent
  // version that touched it. The version snapshot is whole-site (no per-page
  // editor attribution), so V1 maps every page to the website's latest
  // version's `createdBy` / `publishedBy`. Per-page edit attribution is a
  // backend follow-up flagged alongside the per-page analytics gap (audit
  // §2.2 / Session B).
  const latestVersion = history[0];
  const latestActorId = latestVersion
    ? (latestVersion.publishedBy ?? latestVersion.createdBy)
    : null;
  const editedBy: 'you' | 'webnua' =
    latestActorId && user?.id === latestActorId ? 'you' : 'webnua';
  const editedAgo = latestVersion
    ? formatRelativeAgo(latestVersion.publishedAt ?? latestVersion.createdAt)
    : '—';

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <div className="px-10 py-9">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div />
          <WorkspaceContextBanner />
        </div>

        {/* Ink hero — site identity + monthly perf */}
        <WebsiteHero website={website} />

        {/* Domain status + view-live + review entry point */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DomainStatusIndicator
              domain={website.domain}
              clientId={getClientUuidBySlug(website.clientId)}
            />
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings/domains">Manage domains →</Link>
            </Button>
          </div>
          <Button asChild>
            <Link href="/website/review">Review &amp; publish →</Link>
          </Button>
        </div>

        {/* Header strip — wraps every page above */}
        <div className="mb-4">
          <SingletonStrip variant="header" section={snapshot.header} nav={snapshot.nav} />
        </div>

        {/* Page grid — pages in their visual sandwich between header + footer */}
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// PAGES · '}
            <strong className="text-ink">{pages.length}</strong>{' '}
            {pages.length === 1 ? 'page' : 'pages'} ·{' '}
            {isLive ? 'live' : 'unpublished draft'}
          </p>
          <div className="flex items-center gap-2">
            <CapabilityGate capability="editPages" mode="hide">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPagesPanelOpen(true)}
              >
                Manage pages
              </Button>
            </CapabilityGate>
            <NewPageEntry />
          </div>
        </div>
        {pages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule bg-paper px-4 py-6 text-center text-[13px] text-ink-quiet">
            No pages on this website yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page: Page) => (
              <PageGridCard
                key={page.id}
                page={page}
                totals={pageTotalsQuery.data?.get(page.slug)}
                domain={website.domain.primary}
                editedBy={editedBy}
                editedAgo={editedAgo}
                isLive={isLive}
              />
            ))}
          </div>
        )}

        <ManagePagesPanel
          open={pagesPanelOpen}
          onOpenChange={setPagesPanelOpen}
          pages={pages.map((p) => ({
            id: p.id,
            title: p.title,
            type: p.type,
            slug: p.slug,
          }))}
          onSave={(titles) => renamePages(website.id, titles)}
        />

        {/* Footer strip — wraps every page below */}
        <div className="mt-4">
          <SingletonStrip variant="footer" section={snapshot.footer} />
        </div>

        {/* Visitor-engagement insights — surface-level (analytics-audit §3/§4) */}
        <div className="mt-6">
          <WebsiteEngagementCard surfaceId={website.id} />
        </div>

        {/* Recent activity (left) + Open requests (right) */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <WebsiteActivityCard
            websiteId={website.id}
            currentUserId={user?.id ?? null}
          />
          <OpenRequestsCard />
        </div>

        {/* Version history — moved to the bottom from the right rail */}
        <div className="mt-6">
          <VersionHistoryCard
            title={
              <>
                Version <em>history</em>
              </>
            }
            subtitle={
              <>
                <strong>{history.length}</strong>{' '}
                {history.length === 1 ? 'version' : 'versions'}. Restore any
                published version as a new draft.
              </>
            }
            versions={history}
            currentPublishedId={publishedVersion?.id ?? null}
            websiteId={website.id}
          />
        </div>
      </div>
    </>
  );
}

function formatRelativeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}D AGO`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}W AGO`;
  const months = Math.round(days / 30);
  return `${months}MO AGO`;
}

// -- Empty states ----------------------------------------------------------

function AgencyEmptyState() {
  const adminClients = useAdminClients();
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <div className="px-4 py-6 md:px-10 md:py-10">
        <div className="mb-6">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// AGENCY MODE'}
          </p>
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            Pick a client to view their{' '}
            <em className="font-extrabold not-italic text-rust">website</em>.
          </h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-ink-mid">
            You&rsquo;re in agency birds-eye.{' '}
            <strong>Website management happens inside a sub-account</strong> — switch from the
            client picker in the sidebar, or jump straight to the cross-client matrix.
          </p>
        </div>
        <div className="mb-6">
          <WorkspaceContextBanner hideReturnButton />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {adminClients.map((client) => (
            <DrillTile
              key={client.id}
              clientId={client.id}
              clientName={client.name}
              initial={client.initial}
              meta={client.meta}
            />
          ))}
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          Or go to{' '}
          <Link href="/websites" className="text-rust hover:text-rust-deep">
            /websites
          </Link>{' '}
          — the cross-client matrix.
        </p>
      </div>
    </>
  );
}

function DrillTile({
  clientId,
  clientName,
  initial,
  meta,
}: {
  clientId: string;
  clientName: string;
  initial: string;
  meta: string;
}) {
  const workspace = useWorkspace();
  return (
    <button
      type="button"
      onClick={() => workspace.setActiveClientId(clientId)}
      className="group flex items-center gap-3 rounded-lg border border-rule bg-card px-4 py-3 text-left transition-colors hover:border-ink/20"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-md bg-ink font-sans text-[13px] font-extrabold text-rust-light"
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink">{clientName}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          {meta}
        </p>
      </div>
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust group-hover:text-rust-deep">
        Drill in →
      </span>
    </button>
  );
}

function NoWebsiteState({
  reason,
  clientId,
  viewerRole,
  refetch,
}: {
  reason: 'no-website-yet' | 'missing-client-membership';
  clientId?: string;
  /** Role of the SIGNED-IN viewer. Drives copy + which CTAs appear. The
   *  operator empty state offers a scaffold action; the client empty state
   *  reads as "your site is being built" + auto-polls until it appears. */
  viewerRole?: 'admin' | 'client';
  /** When set, the client empty state polls the website query so a
   *  refresh-mid-generation customer self-heals into the real hub without
   *  manually reloading. */
  refetch?: () => void;
}) {
  const workspace = useWorkspace();
  const adminClients = useAdminClients();
  const clientName = clientId ? adminClients.find((c) => c.id === clientId)?.name : undefined;

  // Client-role + no-website-yet → render the "we're building your site"
  // empty state. The customer just signed up; the wizard-assets POST has
  // returned but their RLS-bound read may still be catching up. Auto-poll
  // so they self-heal — no operator-targeting scaffold copy, no "spin one
  // up below" CTA (the customer should never see operator concierge
  // actions; the site IS being built for them).
  if (reason === 'no-website-yet' && viewerRole === 'client') {
    return <ClientGenerationInProgressState refetch={refetch} />;
  }

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <div className="px-4 py-6 md:px-10 md:py-10">
        <div className="mb-6">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {reason === 'no-website-yet' ? '// NO WEBSITE YET' : '// NO WORKSPACE'}
          </p>
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            {reason === 'no-website-yet' ? (
              <>{clientName ?? 'This client'} doesn&rsquo;t have a website yet.</>
            ) : (
              <>You aren&rsquo;t a member of any workspace.</>
            )}
          </h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-ink-mid">
            {reason === 'no-website-yet' ? (
              <>
                Every new client gets a Home / About / Services / Contact scaffold at signup.{' '}
                <strong>This client doesn&rsquo;t have one</strong> — operator can spin one up
                below.
              </>
            ) : (
              <>Ask your operator to invite you to a workspace.</>
            )}
          </p>
        </div>
        {reason === 'no-website-yet' && viewerRole === 'admin' ? (
          // Admin-only — Scaffold is an operator concierge action. The
          // cap gate stays as defence in depth (operators hold editPages
          // via ADMIN_DEFAULTS); the role gate is the primary guard so a
          // client with editPages (CLIENT_OWNER_DEFAULTS holds it) never
          // sees it.
          <div className="flex flex-wrap items-start gap-2">
            <CapabilityGate capability="editPages" mode="hide">
              <ScaffoldWebsiteButton
                activeClientSlug={clientId ?? null}
                activeClientName={clientName ?? null}
              />
            </CapabilityGate>
            <Button variant="secondary" onClick={() => workspace.clearActiveClient()}>
              ← Back to agency
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Client-side post-generation loading state. The customer just signed up;
 *  the wizard-assets POST has returned but their RLS-bound read for the
 *  websites row is still catching up (or they refreshed mid-generation).
 *
 *  Polls the website query every 1.5s for up to 30s; once the row lands
 *  the parent re-renders into the real hub. After 30s with no row visible
 *  we surface a "still finishing — refresh in a moment" affordance so
 *  the customer has a clear out instead of staring at a spinner. */
function ClientGenerationInProgressState({
  refetch,
}: {
  refetch?: () => void;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!refetch) return;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
      refetch();
    }, 1500);
    return () => clearInterval(interval);
  }, [refetch]);

  // After 30s the polling stays alive (a slow read is still recoverable),
  // but we surface a friendlier "this is taking longer than usual"
  // affordance + a manual refresh button so the customer isn't stuck on
  // the spinner with no agency.
  const stalled = elapsedMs > 30_000;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-[460px] rounded-2xl border border-rule bg-card px-7 py-8 text-center shadow-card">
          <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {stalled ? '// STILL FINISHING' : '// BUILDING YOUR SITE'}
          </p>
          <h1 className="text-[24px] font-extrabold leading-[1.15] tracking-[-0.01em] text-ink">
            {stalled ? (
              <>This is taking longer than usual.</>
            ) : (
              <>Your site is being built.</>
            )}
          </h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-ink-mid">
            {stalled ? (
              <>
                Your site is ready in the background — give it a refresh and it
                will appear. If it still doesn&rsquo;t load, contact your
                operator.
              </>
            ) : (
              <>
                Give us a moment — we&rsquo;re finishing the last few sections.
                This page will refresh on its own when it&rsquo;s ready.
              </>
            )}
          </p>
          {stalled ? (
            <div className="mt-5">
              <Button onClick={() => window.location.reload()}>Refresh now</Button>
            </div>
          ) : (
            <div
              className="mt-6 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet"
              aria-live="polite"
            >
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rust" />
              Polling…
            </div>
          )}
        </div>
      </div>
    </>
  );
}
