'use client';

// =============================================================================
// /funnels/[id] — funnel detail. Everything on this page derives from the
// funnel's live Supabase record (`funnels` + `funnel_versions`) — there is no
// hardcoded per-client stub anymore.
//
// Funnel *analytics* (visit counts, conversion %, drop-off, performance
// insights) has no Supabase schema home yet — it is integration data that
// arrives with the GA4 / Meta Ads wiring (Phase 7). Those slots render honest
// "awaiting analytics" placeholders, exactly as campaigns / automations do.
// The funnel identity, its steps and its version history ARE real and wired.
// =============================================================================

import { useParams } from 'next/navigation';

import { FunnelFlow } from '@/components/client/funnels/FunnelFlow';
import { FunnelHero } from '@/components/client/funnels/FunnelHero';
import { FunnelHistoryCard } from '@/components/client/funnels/FunnelHistoryCard';
import { FunnelInsightsCard } from '@/components/client/funnels/FunnelInsightsCard';
import { FunnelSlugEditor } from '@/components/client/funnels/FunnelSlugEditor';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { useCanAny } from '@/lib/auth/user-stub';
import { useFunnelVersions, useFunnelWithDraft } from '@/lib/funnel/queries';
import type {
  FunnelStep as EditableFunnelStep,
  FunnelVersion as EditableFunnelVersion,
  FunnelStepType,
} from '@/lib/funnel/types';
import type {
  FunnelArrow,
  FunnelStep,
  FunnelVersion,
} from '@/lib/funnels/types';
import { relativeTime } from '@/lib/time';

// -- Step-type → presentation maps -------------------------------------------

const STEP_POSITION_LABEL: Record<FunnelStepType, string> = {
  landing: 'Landing',
  schedule: 'Schedule',
  thanks: 'Booked',
  optin: 'Opt-in',
  upsell: 'Upsell',
};

const STEP_THUMB: Record<FunnelStepType, FunnelStep['thumb']> = {
  landing: 'landing',
  schedule: 'schedule',
  thanks: 'thanks',
  optin: 'landing',
  upsell: 'schedule',
};

const VERSION_STATUS_LABEL: Record<EditableFunnelVersion['status'], string> = {
  draft: 'Working draft',
  pending_approval: 'Pending review',
  published: 'Published',
  archived: 'Archived',
};

const Dash = () => <span className="text-ink-quiet">—</span>;

// -- Builders (live record → display shape) ----------------------------------

function buildSteps(
  editorSteps: EditableFunnelStep[],
  publicUrl: string,
): FunnelStep[] {
  return editorSteps.map((step, i) => ({
    id: step.id,
    position: i + 1,
    positionLabel: STEP_POSITION_LABEL[step.type] ?? `Step ${i + 1}`,
    tone: i === 0 ? 'first' : i === editorSteps.length - 1 ? 'last' : 'middle',
    thumb: STEP_THUMB[step.type] ?? 'landing',
    name: step.title,
    url: (i === 0 ? publicUrl : `${publicUrl}/${step.slug}`).replace(/\/+$/, ''),
    metricNum: <Dash />,
    metricLabel: '// Awaiting analytics',
    foot: [],
  }));
}

function buildArrows(stepCount: number): FunnelArrow[] {
  return Array.from({ length: Math.max(0, stepCount - 1) }, (_, i) => ({
    id: `arrow-${i}`,
    pct: '—',
    dropLabel: <>Awaiting analytics</>,
  }));
}

function buildHistory(
  versions: EditableFunnelVersion[],
  publishedVersionId: string | null,
): FunnelVersion[] {
  return versions.map((v, i) => ({
    id: v.id,
    label: `v${versions.length - i}`,
    current: v.id === publishedVersionId,
    body: v.notes ? <>{v.notes}</> : <>{VERSION_STATUS_LABEL[v.status]}</>,
    meta: `${VERSION_STATUS_LABEL[v.status]} · ${relativeTime(v.createdAt)}`,
    when: relativeTime(v.createdAt),
  }));
}

// -- Page --------------------------------------------------------------------

export default function FunnelDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const canEdit = useCanAny(
    'editCopy',
    'editMedia',
    'editSEO',
    'editLayout',
    'editSections',
    'publish',
  );

  const { data, isLoading, isError } = useFunnelWithDraft(id);
  const { data: versions } = useFunnelVersions(id);

  if (isLoading) {
    return <StatusState message="// Loading funnel…" id={id} />;
  }
  if (isError || !data) {
    return <NotFoundState id={id} />;
  }

  const { funnel, draft } = data;
  const editorSteps = draft.snapshot.steps;
  const firstStepId = editorSteps[0]?.id;
  // The funnel is served at {websiteHost}/{slug}. `funnel.clientId` carries
  // the client slug (see lib/funnel/queries.tsx mapFunnel).
  const funnelSlug = funnel.slug ?? 'offer';
  const host = `${funnel.clientId}.webnua.dev`;
  const publicUrl = `${host}/${funnelSlug}`;

  const steps = buildSteps(editorSteps, publicUrl);
  const arrows = buildArrows(steps.length);
  const history = buildHistory(versions ?? [], funnel.publishedVersionId);

  const currentVersion = history.find((h) => h.current);
  const versionLabel = currentVersion
    ? `${currentVersion.label} · live`
    : 'Draft only';

  return (
    <>
      <Topbar
        breadcrumb={<TopbarBreadcrumb trail={['Funnels']} current={funnel.name} />}
      />
      <div className="flex flex-col gap-4 px-10 py-7">
        <FunnelHero
          back={{ label: 'Back to funnels', href: '/funnels' }}
          tag="Webnua-managed funnel"
          title={funnel.name}
          subtitle={
            <>
              Your booking funnel at <strong>{publicUrl}</strong>. A{' '}
              {steps.length}-step path from landing to booked — Webnua manages
              updates, request a change anytime.
            </>
          }
          meta={[
            { label: 'Built', value: relativeTime(funnel.createdAt) },
            { label: 'Steps', value: <>{steps.length}</> },
          ]}
          versionLabel={versionLabel}
          actions={buildHeroActions(canEdit, firstStepId, publicUrl, funnel.id)}
          agg={{
            label: '// Funnel performance',
            live: false,
            metrics: [
              { num: <Dash />, label: '// Visits in' },
              { num: <Dash />, label: '// Booked' },
            ],
            bottom: {
              left: <>Performance tracking</>,
              right: <>Awaiting analytics</>,
            },
          }}
        />

        <FunnelSlugEditor
          funnelId={funnel.id}
          host={host}
          slug={funnelSlug}
          canEdit={canEdit}
        />

        <FunnelFlow
          title={
            <>
              Step-by-step <em>flow</em>
            </>
          }
          steps={steps}
          arrows={arrows}
          periods={['7d', '14d', '30d', '90d']}
          defaultPeriod="14d"
          stepEditHrefs={
            canEdit
              ? editorSteps.map((s) => `/funnels/${funnel.id}/edit/${s.id}`)
              : undefined
          }
        />

        <div className="grid grid-cols-2 gap-3.5">
          <FunnelInsightsCard
            title={
              <>
                <em>Insights</em> · what we see
              </>
            }
            subtitle={
              <>Performance insights appear once your funnel has live traffic.</>
            }
            items={[
              {
                id: 'awaiting-analytics',
                tone: 'info',
                glyph: 'i',
                body: (
                  <>
                    <strong>Analytics aren&apos;t connected yet.</strong> Once
                    Google Analytics is wired up, Webnua will track visits,
                    drop-off and conversion here and flag what&apos;s working
                    or breaking.
                  </>
                ),
                meta: 'Awaiting analytics integration',
              },
            ]}
          />
          <FunnelHistoryCard
            title={
              <>
                Build <em>history</em>
              </>
            }
            subtitle={
              <>Every version of your funnel — Webnua keeps these for rollback.</>
            }
            items={history}
            ctaLabel="+ Request a change"
            ctaHref="/tickets/new"
          />
        </div>
      </div>
    </>
  );
}

function buildHeroActions(
  canEdit: boolean,
  firstStepId: string | undefined,
  publicUrl: string,
  funnelId: string,
) {
  return {
    viewLiveLabel: '⌕ View live',
    viewLiveHref: `https://${publicUrl}`,
    requestChangeLabel: '+ Request a change',
    requestChangeHref: '/tickets/new',
    ...(canEdit && firstStepId
      ? {
          editFunnelLabel: 'Edit funnel →',
          editFunnelHref: `/funnels/${funnelId}/edit/${firstStepId}`,
        }
      : {}),
  };
}

function StatusState({ message, id }: { message: string; id: string }) {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Funnels']} current={id} />} />
      <div className="px-10 py-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
          {message}
        </p>
      </div>
    </>
  );
}

function NotFoundState({ id }: { id: string }) {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Funnels']} current={id} />} />
      <div className="px-10 py-10">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-warn">
          {'// FUNNEL NOT FOUND'}
        </p>
        <p className="text-[15px] text-ink">
          No funnel resolves to &ldquo;{id}&rdquo;, or it&rsquo;s outside your
          workspace.
        </p>
      </div>
    </>
  );
}
