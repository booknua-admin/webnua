'use client';

// =============================================================================
// /websites — admin-only cross-client matrix. Agency-level birds-eye on
// every client's website state. One row per client; key columns:
//
//   client / status / pages / draft state / last published / Open
//
// Clicking "Open →" switches the workspace context to that client and
// routes to /website (the sub-account hub). NeatWorks shows as
// "no website yet" with a build CTA. Pre-launch states surface.
// =============================================================================

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { Button } from '@/components/ui/button';
import { adminClients } from '@/lib/nav/admin-clients';
import {
  STUB_VERSIONS,
  STUB_WEBSITES,
  findWebsiteByClient,
} from '@/lib/website/data-stub';
import type { Website } from '@/lib/website/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
});

export default function AdminWebsitesPage() {
  const workspace = useWorkspace();
  const router = useRouter();

  const rows = adminClients.map((client) => ({
    client,
    website: findWebsiteByClient(client.id),
  }));

  const totalWebsites = STUB_WEBSITES.length;
  const totalPublished = STUB_WEBSITES.filter(
    (w) => w.publishedVersionId !== null,
  ).length;
  const totalPagesAcrossAll = STUB_VERSIONS.filter(
    (v) => v.status === 'published',
  ).reduce((s, v) => s + v.snapshot.pages.length, 0);

  const handleDrillIn = (clientId: string) => {
    workspace.setActiveClientId(clientId);
    router.push('/website');
  };

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Websites" />} />
      <div className="px-10 py-9">
        <PageHeader
          eyebrow="// AGENCY · WEBSITES MATRIX"
          title={
            <>
              Every client&rsquo;s <em>website</em>, at a glance.
            </>
          }
          subtitle={
            <>
              Birds-eye on publish state across the workspace.{' '}
              <strong>Drill in to make changes</strong> — every row routes
              to that client&rsquo;s sub-account website hub.
            </>
          }
        />

        <div className="mb-6">
          <WorkspaceContextBanner hideReturnButton />
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3.5">
          <StatTile
            label="Clients with a website"
            value={`${totalWebsites}/${adminClients.length}`}
          />
          <StatTile
            label="Published websites"
            value={`${totalPublished}`}
            tone={totalPublished < totalWebsites ? 'warn' : 'default'}
          />
          <StatTile
            label="Live pages total"
            value={`${totalPagesAcrossAll}`}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-rule bg-card">
          <div className="grid grid-cols-[40px_1.4fr_120px_90px_140px_140px_120px] gap-3 border-b border-rule bg-paper-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            <span />
            <span>Client</span>
            <span>Status</span>
            <span>Pages</span>
            <span>Draft</span>
            <span>Last published</span>
            <span />
          </div>
          {rows.map(({ client, website }) => (
            <MatrixRow
              key={client.id}
              clientName={client.name}
              clientInitial={client.initial}
              website={website ?? null}
              onDrillIn={() => handleDrillIn(client.id)}
            />
          ))}
        </div>

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          Showing every client in the workspace. Clients with no website yet
          get a build CTA. Per-website integrations live at{' '}
          <Link href="/integrations" className="text-rust hover:text-rust-deep">
            /integrations
          </Link>
          .
        </p>
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <div className="rounded-lg border border-rule bg-card px-4 py-3.5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
        {label}
      </p>
      <p
        className={
          'mt-1 text-[26px] font-bold leading-none tracking-[-0.01em] ' +
          (tone === 'warn' ? 'text-warn' : 'text-ink')
        }
      >
        {value}
      </p>
    </div>
  );
}

function MatrixRow({
  clientName,
  clientInitial,
  website,
  onDrillIn,
}: {
  clientName: string;
  clientInitial: string;
  website: Website | null;
  onDrillIn: () => void;
}) {
  const isEmpty = website === null;

  const pageCount = (() => {
    if (!website) return 0;
    const draft = STUB_VERSIONS.find((v) => v.id === website.draftVersionId);
    return draft?.snapshot.pages.length ?? 0;
  })();

  const draftSummary = (() => {
    if (!website) return '—';
    const draft = STUB_VERSIONS.find((v) => v.id === website.draftVersionId);
    if (!draft) return '—';
    if (website.publishedVersionId == null) return 'first draft';
    // Compare snapshots — for the stub, just check timestamps as a proxy.
    const published = STUB_VERSIONS.find(
      (v) => v.id === website.publishedVersionId,
    );
    if (!published) return '—';
    return draft.createdAt > published.createdAt
      ? 'ahead of live'
      : 'matches live';
  })();

  const lastPublished = (() => {
    if (!website || !website.publishedVersionId) return null;
    const v = STUB_VERSIONS.find((x) => x.id === website.publishedVersionId);
    return v?.publishedAt ?? v?.createdAt ?? null;
  })();

  return (
    <div className="grid grid-cols-[40px_1.4fr_120px_90px_140px_140px_120px] items-center gap-3 border-b border-paper-2 bg-card px-5 py-4 last:border-b-0">
      <div
        aria-hidden
        className={
          'flex h-9 w-9 items-center justify-center rounded-md font-sans text-[13px] font-extrabold ' +
          (isEmpty ? 'bg-paper-2 text-ink-quiet' : 'bg-ink text-rust-light')
        }
      >
        {clientInitial}
      </div>
      <div>
        <p className="text-[14px] font-bold text-ink">{clientName}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
          {isEmpty ? '—' : website.domain.primary}
        </p>
      </div>
      <div>
        {isEmpty ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
            No website
          </span>
        ) : website.publishedVersionId ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-good">
            <span aria-hidden className="size-1.5 rounded-full bg-good" />
            Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
            <span aria-hidden className="size-1.5 rounded-full bg-warn" />
            Unpublished
          </span>
        )}
      </div>
      <div className="text-[13px] text-ink">
        {isEmpty ? <span className="text-ink-quiet">—</span> : pageCount}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
        {draftSummary}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
        {lastPublished
          ? TIMESTAMP_FORMATTER.format(new Date(lastPublished))
          : '—'}
      </div>
      <div className="text-right">
        {isEmpty ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/clients/new/basics">Build →</Link>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onDrillIn}>
            Drill in →
          </Button>
        )}
      </div>
    </div>
  );
}
