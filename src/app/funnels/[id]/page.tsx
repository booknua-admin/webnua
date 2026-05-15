'use client';

// =============================================================================
// /funnels/[id] — funnel detail (Session 7).
//
// Renders the existing analytics-detail stub (`voltlineFunnel` from
// `lib/funnels/client-detail`) augmented with an operator-facing
// "Edit funnel →" CTA on the hero. The CTA points at the first step of
// the funnel's editable model (resolved from `lib/funnel/data-stub`).
//
// Cap gating: the CTA only renders for users with any edit capability
// (matches the design doc §1 view-only floor — readers shouldn't see an
// editing affordance at all).
// =============================================================================

import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { FunnelFlow } from '@/components/client/funnels/FunnelFlow';
import { FunnelHero } from '@/components/client/funnels/FunnelHero';
import { FunnelHistoryCard } from '@/components/client/funnels/FunnelHistoryCard';
import { FunnelInsightsCard } from '@/components/client/funnels/FunnelInsightsCard';
import { useCanAny } from '@/lib/auth/user-stub';
import { findFunnel, getDraftForFunnel } from '@/lib/funnel/data-stub';
import { voltlineFunnel } from '@/lib/funnels/client-detail';
import { useParams } from 'next/navigation';

export default function FunnelDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? voltlineFunnel.id;

  const canEdit = useCanAny(
    'editCopy',
    'editMedia',
    'editSEO',
    'editLayout',
    'editSections',
    'publish',
  );

  // Stub layer: the analytics-detail funnel only exists for Voltline. Any
  // other id falls through to a "not found" surface.
  if (id !== voltlineFunnel.id) {
    return <NotFoundState id={id} />;
  }

  const funnel = voltlineFunnel;
  const editableFunnel = findFunnel(id);
  const draft = editableFunnel ? getDraftForFunnel(id) : null;
  const firstStepId = draft?.snapshot.steps[0]?.id;

  const heroActions = {
    ...funnel.hero.actions,
    ...(canEdit && editableFunnel && firstStepId
      ? {
          editFunnelLabel: 'Edit funnel →',
          editFunnelHref: `/funnels/${editableFunnel.id}/edit/${firstStepId}`,
        }
      : {}),
  };

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Funnels']} current="$99 emergency call-out" />
        }
      />
      <div className="flex flex-col gap-4 px-10 py-7">
        <FunnelHero
          back={funnel.back}
          tag={funnel.hero.tag}
          title={funnel.hero.title}
          subtitle={funnel.hero.subtitle}
          meta={funnel.hero.meta}
          versionLabel={funnel.hero.versionLabel}
          actions={heroActions}
          agg={funnel.agg}
        />

        <FunnelFlow
          title={funnel.flow.title}
          steps={funnel.steps}
          arrows={funnel.arrows}
          periods={funnel.flow.periods}
          defaultPeriod={funnel.flow.defaultPeriod}
        />

        <div className="grid grid-cols-2 gap-3.5">
          <FunnelInsightsCard
            title={funnel.insights.title}
            subtitle={funnel.insights.subtitle}
            items={funnel.insights.items}
          />
          <FunnelHistoryCard
            title={funnel.history.title}
            subtitle={funnel.history.subtitle}
            items={funnel.history.items}
            ctaLabel={funnel.history.ctaLabel}
            ctaHref={funnel.history.ctaHref}
          />
        </div>
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
          No funnel resolves to &ldquo;{id}&rdquo; in the stub layer.
        </p>
      </div>
    </>
  );
}
