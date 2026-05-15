'use client';

// =============================================================================
// /website — workspace-scoped website hub.
//
//   client role        → their workspace's website (resolved from user.clientId)
//   admin agency mode  → empty state pointing to the picker
//   admin sub-account  → that client's website hub
//   admin/client with no website yet (e.g. NeatWorks, or a brand-new
//     client) → "no website yet" empty state with capability-gated CTA
// =============================================================================

import Link from 'next/link';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { PageGridCard } from '@/components/shared/website/PageGridCard';
import { VersionHistoryCard } from '@/components/shared/website/VersionHistoryCard';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/auth/user-stub';
import { adminClients } from '@/lib/nav/admin-clients';
import { STUB_VERSIONS, findWebsiteByClient } from '@/lib/website/data-stub';
import { findVersion } from '@/lib/website/data-stub';
import type { Page, Version, Website } from '@/lib/website/types';
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

  // Resolve the active website by role + workspace context.
  const activeClientId =
    user.role === 'client' ? user.clientId : workspace.activeClientId;

  // Admin in agency mode (no active client) → empty state.
  if (user.role === 'admin' && !activeClientId) {
    return <AgencyEmptyState />;
  }

  // No website resolvable (client without one, or admin sub-account with a
  // client like NeatWorks that has no website yet).
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
  const pages = draftVersion?.snapshot.pages ?? [];

  // Show every version for this website (draft + published + history).
  const history: Version[] = STUB_VERSIONS.filter(
    (v) => v.websiteId === website.id,
  ).sort((a, b) => {
    // Live first, then drafts, then pending, then archived; within each
    // bucket newest first.
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
      <Topbar
        breadcrumb={<TopbarBreadcrumb current="Website" />}
      />
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
              Your live website plus its current draft. Click any page to open
              the editor. Capability gates inside decide what each user can
              change.
            </p>
          </div>
          <WorkspaceContextBanner />
        </div>

        <div className="mb-7 grid gap-4 md:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                <strong className="text-ink">{pages.length}</strong>{' '}
                {pages.length === 1 ? 'page' : 'pages'} ·{' '}
                {website.publishedVersionId ? 'live' : 'unpublished draft'}
              </p>
              <CapabilityGate capability="editPages" mode="disable">
                <Button size="sm">+ New page</Button>
              </CapabilityGate>
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
            <DrillTile key={client.id} clientId={client.id} clientName={client.name} initial={client.initial} meta={client.meta} />
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
                Generate a draft from the onboarding flow, or import an
                existing site.{' '}
                <strong>Both paths are operator-only.</strong>
              </>
            ) : (
              <>
                Ask your operator to invite you to a workspace.
              </>
            )}
          </p>
        </div>
        {reason === 'no-website-yet' ? (
          <div className="flex flex-wrap items-center gap-2">
            <CapabilityGate capability="editPages" mode="hide">
              <Button asChild>
                <Link href="/clients/new/basics">+ Start a new build</Link>
              </Button>
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
