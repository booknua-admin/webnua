'use client';

// =============================================================================
// /funnels — workspace-scoped funnel hub. Context-aware (Session 7):
//
//   client role        → their workspace's funnels (resolved from user.clientId)
//   admin agency mode  → cross-client roster
//   admin sub-account  → that client's funnel list
//
// Mirrors `/website/page.tsx` in shape — context resolution + per-mode
// rendering. The cross-client roster here is intentionally simpler than the
// websites matrix (no per-integration columns yet); we'll grow it as the
// agency surface needs surface.
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
import {
  STUB_FUNNELS,
  getFunnelsForClient,
} from '@/lib/funnel/data-stub';
import type { Funnel } from '@/lib/funnel/types';
import { adminClients } from '@/lib/nav/admin-clients';
import { useWorkspace } from '@/lib/workspace/workspace-stub';

export default function FunnelsHubPage() {
  const user = useUser();
  const workspace = useWorkspace();

  if (!workspace.hydrated || !user) {
    return (
      <>
        <Topbar breadcrumb={<TopbarBreadcrumb current="Funnels" />} />
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
    return <AdminAgencyRoster />;
  }

  if (!activeClientId) {
    return <NoFunnelsState reason="missing-client-membership" />;
  }

  const funnels = getFunnelsForClient(activeClientId);
  return (
    <ClientFunnelsList
      funnels={funnels}
      isOperator={user.role === 'admin'}
      activeClientId={activeClientId}
    />
  );
}

// -- Client / sub-account list --------------------------------------------

function ClientFunnelsList({
  funnels,
  isOperator,
  activeClientId,
}: {
  funnels: Funnel[];
  isOperator: boolean;
  activeClientId: string;
}) {
  const client = adminClients.find((c) => c.id === activeClientId);
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
                  : ' — text Craig to change anything, or open a funnel and use the funnel editor if you have edit access.'}
              </>
            }
          />
          <WorkspaceContextBanner />
        </div>

        {funnels.length === 0 ? (
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
      className="group flex items-center gap-6 rounded-[14px] border border-rule bg-card px-6 py-5 transition-colors hover:border-rust"
    >
      <div className="flex items-center gap-1.5">
        <FunnelStepThumbnail variant="landing" className="w-28" />
        <span className="font-mono text-[12px] text-ink-quiet">→</span>
        <FunnelStepThumbnail variant="schedule" className="w-28" />
        <span className="font-mono text-[12px] text-ink-quiet">→</span>
        <FunnelStepThumbnail variant="thanks" className="w-28" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <Eyebrow tone="rust">{'// Webnua-managed'}</Eyebrow>
          <Badge variant="muted" className="gap-1.5">
            <StatusDot tone={funnel.publishedVersionId ? 'good' : 'warn'} />
            {funnel.publishedVersionId ? 'Live' : 'Draft only'}
          </Badge>
        </div>
        <div className="text-[20px] font-extrabold tracking-[-0.02em] text-ink [&_em]:not-italic [&_em]:text-rust">
          {funnel.name}
        </div>
        <div className="mt-1 font-mono text-[11px] tracking-[0.04em] text-ink-quiet">
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
      <div className="px-10 py-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn">
          {`// CAN'T RESOLVE WORKSPACE (${reason})`}
        </p>
      </div>
    </>
  );
}

// -- Admin agency roster --------------------------------------------------

function AdminAgencyRoster() {
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

        <div className="grid grid-cols-1 gap-3">
          {adminClients.map((client) => {
            const funnels = getFunnelsForClient(client.id);
            const live = funnels.filter((f) => f.publishedVersionId).length;
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
                className="group grid grid-cols-[48px_1fr_120px_120px_70px] items-center gap-5 rounded-[14px] border border-rule bg-card px-6 py-4 transition-colors hover:border-rust"
              >
                <div className="flex size-12 items-center justify-center rounded-md bg-ink font-extrabold text-rust-light">
                  {client.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-[16px] font-extrabold tracking-[-0.02em] text-ink">
                    {client.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                    {client.id}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-ink">
                    {funnels.length}
                  </div>
                  <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                    Total
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[20px] font-extrabold leading-none tracking-[-0.02em] text-good">
                    {live}
                  </div>
                  <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
                    Live
                  </div>
                </div>
                <span className="text-right font-mono text-[12px] font-bold tracking-[0.04em] text-rust transition-transform group-hover:translate-x-0.5">
                  {funnels.length > 0 ? 'Drill in →' : 'Open →'}
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 max-w-[640px] font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-quiet">
          {'// '}Total funnels across the workspace:{' '}
          <strong className="text-ink">{STUB_FUNNELS.length}</strong>
          {' · '}
          {STUB_FUNNELS.filter((f) => f.publishedVersionId).length} live.
        </p>
      </div>
    </>
  );
}
