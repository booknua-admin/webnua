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

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { NewPageEntry } from '@/components/shared/website/NewPageEntry';
import { PageGridCard } from '@/components/shared/website/PageGridCard';
import { VersionHistoryCard } from '@/components/shared/website/VersionHistoryCard';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { adminClients } from '@/lib/nav/admin-clients';
import {
  STUB_VERSIONS,
  findVersion,
  findWebsiteByClient,
} from '@/lib/website/data-stub';
import { mergeGeneratedPages } from '@/lib/website/generated-pages-stub';
import {
  MAX_NAV_LINKS,
  type NavLink as NavLinkType,
  type Page,
  type Section,
  type Version,
  type Website,
} from '@/lib/website/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function WebsiteHubPage() {
  const user = useUser();
  const workspace = useWorkspace();

  if (!workspace.hydrated || !user) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
        <div className="px-10 py-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            {'// Resolving workspace…'}
          </p>
        </div>
      </>
    );
  }

  const activeClientId =
    user.role === 'client' ? user.clientId : workspace.activeClientId;

  if (user.role === 'admin' && !activeClientId) {
    return <AgencyEmptyState />;
  }

  if (!activeClientId) {
    return <NoWebsiteState reason="missing-client-membership" />;
  }

  const website = findWebsiteByClient(activeClientId);
  if (!website) {
    return <NoWebsiteState reason="no-website-yet" clientId={activeClientId} />;
  }

  return <WebsiteHub website={website} />;
}

// -- Connected website hub (the happy path) --------------------------------

function WebsiteHub({ website }: { website: Website }) {
  const draftVersion = findVersion(website.draftVersionId);
  const publishedVersion = website.publishedVersionId
    ? findVersion(website.publishedVersionId)
    : null;

  if (!draftVersion) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
        <div className="px-10 py-10">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn">
            No draft version on this website.
          </p>
        </div>
      </>
    );
  }

  const snapshot = draftVersion.snapshot;
  const pages = mergeGeneratedPages(website.id, snapshot.pages);

  const history: Version[] = STUB_VERSIONS.filter(
    (v) => v.websiteId === website.id,
  ).sort((a, b) => {
    const order: Record<Version['status'], number> = {
      published: 0,
      pending_approval: 1,
      draft: 2,
      archived: 3,
    };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return (b.publishedAt ?? b.createdAt).localeCompare(
      a.publishedAt ?? a.createdAt,
    );
  });

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <div className="px-10 py-9">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
              {`// ${website.domain.primary}`}
            </p>
            <h1 className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
              {website.name}&rsquo;s <em className="font-extrabold not-italic text-rust">website</em>.
            </h1>
            <p className="mt-2 max-w-[600px] text-[14px] leading-[1.55] text-ink-mid">
              The current draft of every page on this website, plus the
              header / footer / nav that wraps them. <strong>Funnels are a
              separate surface</strong> — find them at{' '}
              <Link href="/funnels" className="text-rust hover:text-rust-deep">
                /funnels
              </Link>
              .
            </p>
          </div>
          <WorkspaceContextBanner />
        </div>

        {/* Header + Footer + Nav — website-level singletons */}
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <SingletonCard
            label="Header"
            description="Logo + nav + optional global CTA. Wraps every page."
            href="/website/header"
            section={snapshot.header}
          />
          <SingletonCard
            label="Footer"
            description="Links + contact info + socials + legal. Wraps every page."
            href="/website/footer"
            section={snapshot.footer}
          />
          <NavSummaryCard nav={snapshot.nav} pages={pages} />
        </div>

        {/* Page grid + version history */}
        <div className="grid gap-4 md:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                <strong className="text-ink">{pages.length}</strong>{' '}
                {pages.length === 1 ? 'page' : 'pages'} ·{' '}
                {website.publishedVersionId ? 'live' : 'unpublished draft'}
              </p>
              <NewPageEntry />
            </div>
            {pages.length === 0 ? (
              <p className="rounded-lg border border-dashed border-rule bg-paper px-4 py-6 text-center text-[13px] text-ink-quiet">
                No pages on this website yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pages.map((page: Page) => (
                  <PageGridCard key={page.id} page={page} />
                ))}
              </div>
            )}
          </div>

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
          />
        </div>
      </div>
    </>
  );
}

// -- Singleton + nav cards (website-hub-specific) --------------------------

function SingletonCard({
  label,
  description,
  href,
  section,
}: {
  label: string;
  description: string;
  href: string;
  section: Section;
}) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-lg border border-rule bg-card transition-colors hover:border-ink/20"
    >
      <div className="border-b border-rule bg-paper-2 px-4 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {`// WEBSITE-LEVEL · ${label.toUpperCase()}`}
        </p>
      </div>
      <div className="px-4 py-4">
        <p className="mb-1 text-[15px] font-bold text-ink">{label}</p>
        <p className="text-[12.5px] leading-[1.5] text-ink-quiet">{description}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          {section.enabled ? 'On' : 'Off'} · singleton
        </p>
      </div>
      <div className="border-t border-rule bg-paper-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust group-hover:text-rust-deep">
        Open editor →
      </div>
    </Link>
  );
}

function NavSummaryCard({
  nav,
  pages,
}: {
  nav: NavLinkType[];
  pages: Page[];
}) {
  const pageById = new Map(pages.map((p) => [p.id, p]));
  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-card">
      <div className="border-b border-rule bg-paper-2 px-4 py-2.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
          {'// WEBSITE-LEVEL · NAV'}
        </p>
      </div>
      <div className="px-4 py-4">
        <p className="mb-1 text-[15px] font-bold text-ink">Top navigation</p>
        <p className="mb-3 text-[12.5px] leading-[1.5] text-ink-quiet">
          Up to <strong>{MAX_NAV_LINKS}</strong> top-level links. Edit the
          full nav in the Header editor.
        </p>
        <ul className="space-y-1">
          {nav.length === 0 ? (
            <li className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
              No links yet.
            </li>
          ) : (
            nav.map((link, i) => {
              const targetLabel =
                link.target.kind === 'page'
                  ? (pageById.get(link.target.pageId)?.slug ?? '?')
                  : link.target.href;
              return (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
                >
                  <span className="text-ink">{link.label}</span>
                  <span className="text-ink-quiet">/{targetLabel}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

// -- Empty states ----------------------------------------------------------

function AgencyEmptyState() {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <div className="px-10 py-10">
        <div className="mb-6">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {'// AGENCY MODE'}
          </p>
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            Pick a client to view their <em className="font-extrabold not-italic text-rust">website</em>.
          </h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-ink-mid">
            You&rsquo;re in agency birds-eye. <strong>Website management
            happens inside a sub-account</strong> — switch from the client
            picker in the sidebar, or jump straight to the cross-client
            matrix.
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
}: {
  reason: 'no-website-yet' | 'missing-client-membership';
  clientId?: string;
}) {
  const workspace = useWorkspace();
  const clientName =
    clientId ? adminClients.find((c) => c.id === clientId)?.name : undefined;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Website" />} />
      <div className="px-10 py-10">
        <div className="mb-6">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
            {reason === 'no-website-yet'
              ? '// NO WEBSITE YET'
              : '// NO WORKSPACE'}
          </p>
          <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            {reason === 'no-website-yet' ? (
              <>
                {clientName ?? 'This client'} doesn&rsquo;t have a website yet.
              </>
            ) : (
              <>You aren&rsquo;t a member of any workspace.</>
            )}
          </h1>
          <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-ink-mid">
            {reason === 'no-website-yet' ? (
              <>
                Every new client gets a Home / About / Services / Contact
                scaffold at signup. <strong>This client doesn&rsquo;t
                have one</strong> — operator can spin one up below.
              </>
            ) : (
              <>Ask your operator to invite you to a workspace.</>
            )}
          </p>
        </div>
        {reason === 'no-website-yet' ? (
          <div className="flex flex-wrap items-center gap-2">
            <CapabilityGate capability="editPages" mode="hide">
              <Button>Scaffold a new website</Button>
            </CapabilityGate>
            <Button
              variant="secondary"
              onClick={() => workspace.clearActiveClient()}
            >
              ← Back to agency
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
