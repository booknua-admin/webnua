'use client';

// =============================================================================
// /funnels/[id] — funnel detail (Session 7 · wired Phase 4).
//
// The funnel record + its editable draft resolve live from Supabase
// (`lib/funnel/queries`); the [id] segment is the funnel UUID. The detail
// *content* (hero stats / flow / drop-off / insights / history) is still the
// analytics stub `voltlineFunnel` — funnel analytics has no schema home yet
// (CLAUDE.md §5 metrics gap), and there is only one funnel in the platform.
//
// The operator-facing "Edit funnel →" CTA + per-step deep-links are built
// from the live draft's steps. Cap gating: the CTA only renders for users
// with any edit capability (design doc §1 view-only floor).
// =============================================================================

import { useParams } from 'next/navigation';

import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { FunnelFlow } from '@/components/client/funnels/FunnelFlow';
import { FunnelHero } from '@/components/client/funnels/FunnelHero';
import { FunnelHistoryCard } from '@/components/client/funnels/FunnelHistoryCard';
import { FunnelInsightsCard } from '@/components/client/funnels/FunnelInsightsCard';
import { useCanAny } from '@/lib/auth/user-stub';
import { useFunnelWithDraft } from '@/lib/funnel/queries';
import { voltlineFunnel } from '@/lib/funnels/client-detail';

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

  if (isLoading) {
    return <StatusState tone="quiet" message="// Loading funnel…" id={id} />;
  }

  if (isError || !data) {
    return <NotFoundState id={id} />;
  }

  const { funnel: editableFunnel, draft } = data;
  const editorSteps = draft.snapshot.steps;
  const firstStepId = editorSteps[0]?.id;

  // The analytics-detail content is the single Voltline funnel stub.
  const detail = voltlineFunnel;

  const heroActions = {
    ...detail.hero.actions,
    ...(canEdit && firstStepId
      ? {
          editFunnelLabel: 'Edit funnel →',
          editFunnelHref: `/funnels/${editableFunnel.id}/edit/${firstStepId}`,
        }
      : {}),
  };

  // Per-step editor deep-links — aligned to the analytics flow steps by
  // index. Only handed to FunnelFlow when the viewer can edit, so view-only
  // users get a static (non-clickable) flow.
  const stepEditHrefs = canEdit
    ? detail.steps.map((_, i) => {
        const editorStep = editorSteps[i];
        return editorStep
          ? `/funnels/${editableFunnel.id}/edit/${editorStep.id}`
          : undefined;
      })
    : undefined;

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Funnels']} current={editableFunnel.name} />
        }
      />
      <div className="flex flex-col gap-4 px-10 py-7">
        <FunnelHero
          back={detail.back}
          tag={detail.hero.tag}
          title={detail.hero.title}
          subtitle={detail.hero.subtitle}
          meta={detail.hero.meta}
          versionLabel={detail.hero.versionLabel}
          actions={heroActions}
          agg={detail.agg}
        />

        <FunnelFlow
          title={detail.flow.title}
          steps={detail.steps}
          arrows={detail.arrows}
          periods={detail.flow.periods}
          defaultPeriod={detail.flow.defaultPeriod}
          stepEditHrefs={stepEditHrefs}
        />

        <div className="grid grid-cols-2 gap-3.5">
          <FunnelInsightsCard
            title={detail.insights.title}
            subtitle={detail.insights.subtitle}
            items={detail.insights.items}
          />
          <FunnelHistoryCard
            title={detail.history.title}
            subtitle={detail.history.subtitle}
            items={detail.history.items}
            ctaLabel={detail.history.ctaLabel}
            ctaHref={detail.history.ctaHref}
          />
        </div>
      </div>
    </>
  );
}

function StatusState({
  tone,
  message,
  id,
}: {
  tone: 'quiet' | 'warn';
  message: string;
  id: string;
}) {
  return (
    <>
      <Topbar breadcrumb={<TopbarBreadcrumb trail={['Funnels']} current={id} />} />
      <div className="px-10 py-10">
        <p
          className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
            tone === 'warn' ? 'text-warn' : 'text-ink-quiet'
          }`}
        >
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
