'use client';

// =============================================================================
// /funnels — workspace-scoped funnel hub. Context-aware (Session 7):
//
//   client role        → their workspace's funnels (resolved from user.clientId)
//   admin agency mode  → cross-client roster
//   admin sub-account  → that client's funnel list
//
// Phase 4 — funnel data reads live Supabase (`lib/funnel/queries`). Mirrors
// `/website/page.tsx` in shape — context resolution + per-mode rendering.
// =============================================================================

import Link from 'next/link';

import { FunnelStepThumbnail } from '@/components/client/funnels/FunnelStepThumbnail';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import { Badge } from '@/components/ui/badge';
import { Eyebrow } from '@/components/ui/eyebrow';
import { StatusDot } from '@/components/ui/status-dot';
import { useUser } from '@/lib/auth/user-stub';
import { useAdminClients } from '@/lib/clients/clients-store';
import { useAllFunnels, useFunnelsForClient } from '@/lib/funnel/queries';
import type { Funnel } from '@/lib/funnel/types';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function FunnelsHubPage() {
  const user = useUser();
  const workspace = useWorkspace();

  if (!workspace.hydrated || !user) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Funnels" />} />
        <div className="px-4 py-6 md:px-10 md:py-10">
          <StatusLine tone="quiet">{'// Resolving workspace…'}</StatusLine>
        </div>
      </>
    );
  }

  const activeClientId =
    user.role === 'client' ? user.clientId : workspace.activeClientId;

  if (user.role === 'admin' && !activeClientId) {
    return <AdminAgencyRoster />;
  }

  if (!activeClientId) {
    return <NoFunnelsState reason="missing-client-membership" />;
  }

  return (
    <ClientFunnelsList
      isOperator={user.role === 'admin'}
      activeClientId={activeClientId}
    />
  );
}

// -- Client / sub-account list --------------------------------------------

function ClientFunnelsList({
  isOperator,
  activeClientId,
}: {
  isOperator: boolean;
  activeClientId: string;
}) {
  const { data, isLoading, isError } = useFunnelsForClient(activeClientId);
  const allClients = useAdminClients();
  const funnels = data ?? [];
  const client = allClients.find((c) => c.id === activeClientId);

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Funnels" />} />
      <div className="px-10 py-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <PageHeader
            eyebrow="Funnels"
            title={
              <>
                {isOperator ? `${client?.name ?? 'Client'}'s booking ` : 'Your booking '}
                <em>funnels</em>.
              </>
            }
            subtitle={
              <>
                Linear conversion pipelines — landing → schedule → thanks.
                Click a funnel to see step-by-step performance, drop-off,
                insights and version history.{' '}
                <strong>Webnua manages updates</strong>
                {isOperator
                  ? '.'
                  : ` — message ${process.env.NEXT_PUBLIC_SUPPORT_NAME ?? 'your operator'} to change anything, or open a funnel and use the funnel editor if you have edit access.`}
              </>
            }
          />
          <WorkspaceContextBanner />
        </div>

        {isLoading ? (
          <StatusLine tone="quiet">{'// Loading funnels…'}</StatusLine>
        ) : isError ? (
          <StatusLine tone="warn">
            {'// Could not load funnels. Try again.'}
          </StatusLine>
        ) : funnels.length === 0 ? (
          <EmptyFunnelsState clientName={client?.name ?? null} />
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {funnels.map((funnel) => (
              <FunnelListRow key={funnel.id} funnel={funnel} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function FunnelListRow({ funnel }: { funnel: Funnel }) {
  return (
    <Link
      href={`/funnels/${funnel.id}`}
      className="group flex flex-col gap-4 rounded-[14px] border border-rule bg-card px-4 py-4 transition-colors hover:border-rust md:flex-row md:items-center md:gap-6 md:px-6 md:py-5"
    >
      {/* Thumbnails — wrap on small viewports; horizontal on md+ */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FunnelStepThumbnail variant="landing" className="w-24 md:w-28" />
        <span className="font-mono text-[12px] text-ink-quiet">→</span>
        <FunnelStepThumbnail variant="schedule" className="w-24 md:w-28" />
        <span className="font-mono text-[12px] text-ink-quiet">→</span>
        <FunnelStepThumbnail variant="thanks" className="w-24 md:w-28" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <Eyebrow tone="rust">{'// Webnua-managed'}</Eyebrow>
          <Badge variant="muted" className="gap-1.5">
            <StatusDot tone={funnel.publishedVersionId ? 'good' : 'warn'} />
            {funnel.publishedVersionId ? 'Live' : 'Draft only'}
          </Badge>
        </div>
        <div className="text-[18px] font-extrabold tracking-[-0.02em] text-ink md:text-[20px] [&_em]:not-italic [&_em]:text-rust">
          {funnel.name}
        </div>
        <div className="mt-1 truncate font-mono text-[11px] tracking-[0.04em] text-ink-quiet">
          {funnel.domain.primary}
        </div>
      </div>

      <span className="shrink-0 font-mono text-[12px] font-bold tracking-[0.04em] text-rust transition-transform group-hover:translate-x-0.5">
        Open →
      </span>
    </Link>
  );
}

function EmptyFunnelsState({ clientName }: { clientName: string | null }) {
  return (
    <div className="rounded-xl border border-dashed border-rule bg-paper-2 px-8 py-12 text-center">
      <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
        {'// NO FUNNELS YET'}
      </p>
      <p className="mb-2 text-[18px] font-extrabold tracking-[-0.02em] text-ink">
        {clientName ?? 'This workspace'} doesn&rsquo;t have a funnel yet.
      </p>
      <p className="mx-auto max-w-[440px] text-[13.5px] leading-[1.55] text-ink-quiet">
        Funnels are built by the onboarding wizard. Once a funnel ships,
        it&rsquo;ll show up here with traffic + conversion stats.
      </p>
    </div>
  );
}

function NoFunnelsState({ reason }: { reason: string }) {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Funnels" />} />
      <div className="px-4 py-6 md:px-10 md:py-10">
        <StatusLine tone="warn">
          {`// CAN'T RESOLVE WORKSPACE (${reason})`}
        </StatusLine>
      </div>
    </>
  );
}

// -- Admin agency roster --------------------------------------------------

function AdminAgencyRoster() {
  const { data, isLoading, isError } = useAllFunnels();
  const allClients = useAdminClients();
  const funnels = data ?? [];
  const totalLive = funnels.filter((f) => f.publishedVersionId).length;

  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb current="Funnels" />} />
      <div className="px-10 py-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <PageHeader
            eyebrow="Funnels · all clients"
            title={
              <>
                The agency-wide <em>funnel</em> roster.
              </>
            }
            subtitle={
              <>
                One row per client. <strong>Drill in</strong> to manage that
                client&rsquo;s funnels and open the funnel editor. To work on
                a specific client&rsquo;s funnels, switch workspace context
                with the sidebar client picker.
              </>
            }
          />
          <WorkspaceContextBanner />
        </div>

        {isLoading ? (
          <StatusLine tone="quiet">{'// Loading funnels…'}</StatusLine>
        ) : isError ? (
          <StatusLine tone="warn">
            {'// Could not load funnels. Try again.'}
          </StatusLine>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3">
              {allClients.map((client) => {
                const clientFunnels = funnels.filter(
                  (f) => f.clientId === client.id,
                );
                const live = clientFunnels.filter(
                  (f) => f.publishedVersionId,
                ).length;
                return (
                  <Link
                    key={client.id}
                    href={`/funnels`}
                    onClick={(e) => {
                      // Pure client-side context switch — the sidebar picker
                      // owns persistence; this row is a convenience.
                      e.preventDefault();
                      try {
                        window.localStorage.setItem(
                          'webnua.dev.active-client-id',
                          client.id,
                        );
                        window.dispatchEvent(new Event('storage'));
                      } catch {
                        // localStorage unavailable — fall through to navigate
                      }
                      window.location.href = '/funnels';
                    }}
                    className="group flex items-center gap-4 rounded-[14px] border border-rule bg-card px-4 py-4 transition-colors hover:border-rust md:grid md:grid-cols-[48px_1fr_120px_120px_70px] md:gap-5 md:px-6"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-[14px] font-extrabold text-rust-light md:size-12 md:text-base">
                      {client.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-extrabold tracking-[-0.02em] text-ink md:text-[16px]">
                        {client.name}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                        {client.id}
                      </div>
                    </div>
                    <div className="hidden text-right md:block">
                      <div className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">
                        {clientFunnels.length}
                      </div>
                      <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                        Total
                      </div>
                    </div>
                    <div className="hidden text-right md:block">
                      <div className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-good">
                        {live}
                      </div>
                      <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                        Live
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet md:hidden">
                        <span className="text-ink">{clientFunnels.length}</span> total ·{' '}
                        <span className="text-good">{live}</span> live
                      </span>
                      <span className="font-mono text-[12px] font-bold tracking-[0.04em] text-rust transition-transform group-hover:translate-x-0.5">
                        {clientFunnels.length > 0 ? 'Drill in →' : 'Open →'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <p className="mt-6 max-w-[640px] font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-quiet">
              {'// '}Total funnels across the workspace:{' '}
              <strong className="text-ink">{funnels.length}</strong>
              {' · '}
              {totalLive} live.
            </p>
          </>
        )}
      </div>
    </>
  );
}

// -- Status line helper ---------------------------------------------------

function StatusLine({
  tone,
  children,
}: {
  tone: 'quiet' | 'warn';
  children: React.ReactNode;
}) {
  return (
    <p
      className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
        tone === 'warn' ? 'text-warn' : 'text-ink-quiet'
      }`}
    >
      {children}
    </p>
  );
}
