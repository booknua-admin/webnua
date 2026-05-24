'use client';

// =============================================================================
// /funnels/[id] — funnel detail. Everything on this page derives from the
// funnel's live Supabase record (`funnels` + `funnel_versions`).
//
// Per-step funnel analytics are wired (analytics-audit §2.2 / §2.6, closed by
// migration 0042). `fetchFunnelStepBreakdown` returns per-step visit / form
// counts; this page maps them into the prototype's Screen 23 step + arrow
// shape. The hero's "booked from this funnel" count routes through
// `getBookedFromFunnelCount`, which returns null today and lights up the
// moment the follow-up session adds `source_funnel_id` to `leads`
// (CLAUDE.md "Funnel-to-lead attribution").
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { FunnelFlow } from '@/components/client/funnels/FunnelFlow';
import { FunnelHero } from '@/components/client/funnels/FunnelHero';
import { FunnelHistoryCard } from '@/components/client/funnels/FunnelHistoryCard';
import { FunnelInsightsCard } from '@/components/client/funnels/FunnelInsightsCard';
import { FunnelSlugEditor } from '@/components/client/funnels/FunnelSlugEditor';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  fetchFunnelStepBreakdown,
  getBookedFromFunnelCount,
  type FunnelStepBreakdown,
  type FunnelStepTotals,
} from '@/lib/analytics/queries';
import { useCanAny } from '@/lib/auth/user-stub';
import { useFunnelVersions, useFunnelWithDraft } from '@/lib/funnel/queries';
import { useWebsiteForClient } from '@/lib/website/queries';
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

/** Each funnel step type carries its own per-step primary metric label —
 *  matches the prototype Screen 23 vocabulary (VISITORS / REACHED / COMPLETED).
 *  Falls back to a neutral label for step types we haven't framed yet. */
const STEP_METRIC_LABEL: Record<FunnelStepType, string> = {
  landing: '// Visitors',
  schedule: '// Reached',
  thanks: '// Completed',
  optin: '// Reached',
  upsell: '// Reached',
};

/** A funnel step's `page_ref` in the analytics rollup. The landing step is
 *  served at the funnel root URL ('/') and the tracker emits `page_ref = ''`
 *  for it; later steps emit their slug. Matches the renderer + tracker
 *  behaviour from `lib/public-site/resolve.ts`. */
function stepPageRef(step: EditableFunnelStep, index: number): string {
  return index === 0 ? '' : step.slug;
}

/** Pick which tracked count is the primary metric for a step:
 *   • landing → page views ("visitors")
 *   • subsequent step → page views on that step ("reached")
 *   • last step → form_submitted on the last step ("completed")
 *  The arrows between steps use these in turn. */
function primaryMetricFor(
  step: FunnelStepTotals | undefined,
  position: 'first' | 'middle' | 'last',
): number {
  if (!step) return 0;
  return position === 'last'
    ? step.formSubmitted || step.landing
    : step.landing;
}

// -- Builders (live record → display shape) ----------------------------------

function buildSteps(
  editorSteps: EditableFunnelStep[],
  publicUrl: string,
  breakdown: FunnelStepBreakdown | undefined,
): FunnelStep[] {
  return editorSteps.map((step, i) => {
    const tone: FunnelStep['tone'] =
      i === 0 ? 'first' : i === editorSteps.length - 1 ? 'last' : 'middle';
    const totals = breakdown?.steps[i];
    const hasData = Boolean(breakdown?.hasData);
    const primary = primaryMetricFor(
      totals,
      tone === 'last' ? 'last' : tone === 'first' ? 'first' : 'middle',
    );
    const foot: FunnelStep['foot'] = hasData
      ? buildStepFoot(step.type, totals)
      : [];

    return {
      id: step.id,
      position: i + 1,
      positionLabel: STEP_POSITION_LABEL[step.type] ?? `Step ${i + 1}`,
      tone,
      thumb: STEP_THUMB[step.type] ?? 'landing',
      name: step.title,
      url: (i === 0 ? publicUrl : `${publicUrl}/${step.slug}`).replace(/\/+$/, ''),
      metricNum: hasData ? <em>{primary}</em> : <Dash />,
      metricLabel: STEP_METRIC_LABEL[step.type] ?? '// Reached',
      foot,
    };
  });
}

/** Step footer rows — the per-step engagement readouts in the prototype.
 *  Only rows whose underlying counts the tracker actually emits today are
 *  surfaced. Bookings-side readouts on the `thanks` step (SMS SENT /
 *  SHOWED UP / NO-SHOW) are calendar data, not funnel-tracker data — they
 *  stay placeholder. */
function buildStepFoot(
  type: FunnelStepType,
  totals: FunnelStepTotals | undefined,
): FunnelStep['foot'] {
  if (!totals) return [];
  switch (type) {
    case 'landing':
      // The prototype shows AVG TIME + BOUNCE + SCROLL DEPTH on the
      // landing step; the rollup currently carries scroll depth (engaged
      // is 50%). Avg-time + bounce are page-level, not on the funnel
      // rollup, so omit until the page rollup is keyed to step pages too.
      return [];
    case 'schedule':
    case 'optin':
    case 'upsell':
      return [
        { label: 'FORM STARTS', value: `${totals.formStarted}` },
        {
          label: 'FORM ABANDONS',
          value: dropFraction(totals.formStarted, totals.formAbandoned),
        },
      ];
    case 'thanks':
      // Funnel-tracker has nothing for the thanks step beyond the
      // page_view that landed the visitor — SMS / show-up / no-show
      // come from `bookings`. Until that read path exists, return empty.
      return [];
    default:
      return [];
  }
}

function dropFraction(start: number, abandoned: number): string {
  if (start <= 0) return '0';
  const pct = Math.round((abandoned / start) * 100);
  return `${abandoned} (${pct}%)`;
}

function buildArrows(
  editorSteps: EditableFunnelStep[],
  breakdown: FunnelStepBreakdown | undefined,
): FunnelArrow[] {
  const count = Math.max(0, editorSteps.length - 1);
  return Array.from({ length: count }, (_, i) => {
    const from = breakdown?.steps[i];
    const to = breakdown?.steps[i + 1];
    if (!breakdown?.hasData || !from || !to || from.landing <= 0) {
      return {
        id: `arrow-${i}`,
        pct: '—',
        dropLabel: <>Awaiting analytics</>,
      };
    }
    const pct = Math.round((to.landing / from.landing) * 100);
    const dropped = Math.max(0, from.landing - to.landing);
    return {
      id: `arrow-${i}`,
      pct: `${pct}% →`,
      dropLabel: (
        <>
          <strong>{dropped} dropped</strong> on step {i + 1}
        </>
      ),
    };
  });
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
  // A funnel is served at the *website's* host + /{slug} — not on a host of
  // its own (funnel `domain_primary` is vestigial, see migration 0034). Pull
  // the website so the live link points where the funnel is actually served,
  // including a client's custom domain.
  const { data: website } = useWebsiteForClient(data?.funnel.clientId ?? null);

  // Per-step funnel breakdown — analytics-audit §2.6 close. Drives the step
  // cards, the inter-step arrows, and the hero's visits-in tile. Empty
  // funnels (no rollup rows yet) resolve as `hasData: false`, and the
  // builders below render '—' placeholders, matching the prototype's
  // unpublished-state behaviour.
  const editorSteps = data?.draft.snapshot.steps ?? [];
  const pageRefs = editorSteps.map((step, i) => stepPageRef(step, i));
  const breakdownQuery = useQuery({
    queryKey: ['funnel-step-breakdown', data?.funnel.id, pageRefs],
    queryFn: () => fetchFunnelStepBreakdown(data!.funnel.id, pageRefs),
    enabled: Boolean(data?.funnel.id) && pageRefs.length > 0,
  });

  // Hero "booked from this funnel" — returns null until the follow-up session
  // adds `source_funnel_id` to leads (CLAUDE.md "Funnel-to-lead attribution").
  // The query is shaped now so the surface stays stable across the schema add.
  const bookedQuery = useQuery({
    queryKey: ['funnel-booked', data?.funnel.id],
    queryFn: () => getBookedFromFunnelCount(data!.funnel.id, null),
    enabled: Boolean(data?.funnel.id),
  });

  if (isLoading) {
    return <StatusState message="// Loading funnel…" id={id} />;
  }
  if (isError || !data) {
    return <NotFoundState id={id} />;
  }

  const { funnel } = data;
  const firstStepId = editorSteps[0]?.id;
  // The funnel is served at {websiteHost}/{slug}. `funnel.clientId` carries
  // the client slug (see lib/funnel/queries.tsx mapFunnel).
  const funnelSlug = funnel.slug ?? 'offer';
  // The funnel is served on the website's host (the website's primary domain,
  // which may be a custom domain). Fall back to the platform subdomain only
  // while the website query is still resolving / the client has no website.
  const host = website?.domain.primary ?? `${funnel.clientId}.webnua.dev`;
  const publicUrl = `${host}/${funnelSlug}`;

  const breakdown = breakdownQuery.data;
  const steps = buildSteps(editorSteps, publicUrl, breakdown);
  const arrows = buildArrows(editorSteps, breakdown);
  const history = buildHistory(versions ?? [], funnel.publishedVersionId);

  // Hero "visits in" — sum of the first-step landing rollup; honest dash
  // when there's no data yet. Overall conversion uses the breakdown helper.
  const visitsIn = breakdown?.hasData ? breakdown.steps[0]?.landing ?? 0 : null;
  const bookedCount = bookedQuery.data;
  const conversion = breakdown?.overallConversion ?? null;

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
            label: '// Funnel performance · 7 days',
            live: visitsIn !== null && visitsIn > 0,
            metrics: [
              {
                num: visitsIn === null ? <Dash /> : <em>{visitsIn}</em>,
                label: '// Visits in',
              },
              {
                // `bookedCount` is null until `source_funnel_id` ships on
                // `leads` (CLAUDE.md "Funnel-to-lead attribution") — render
                // an honest '—' with the same surface shape the count will
                // drop into in the follow-up session.
                num:
                  bookedCount === null || bookedCount === undefined ? (
                    <span
                      title="Funnel attribution coming soon."
                      className="text-ink-quiet"
                    >
                      —
                    </span>
                  ) : (
                    <em>{bookedCount}</em>
                  ),
                label: '// Booked',
              },
            ],
            bottom: {
              left:
                conversion === null ? (
                  <>Performance tracking</>
                ) : (
                  <>End-to-end conversion</>
                ),
              right:
                conversion === null ? (
                  <>Awaiting analytics</>
                ) : (
                  <strong>{(conversion * 100).toFixed(1)}%</strong>
                ),
            },
          }}
        />

        <FunnelSlugEditor
          funnelId={funnel.id}
          host={host}
          slug={funnelSlug}
          canEdit={canEdit}
          publishedVersionId={funnel.publishedVersionId}
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
              <>Performance insights appear once your funnel has traffic.</>
            }
            items={[
              {
                id: 'awaiting-analytics',
                tone: 'info',
                glyph: 'i',
                body: (
                  <>
                    <strong>Waiting for traffic.</strong> Webnua tracks every
                    visit, scroll, form interaction and conversion in-app — no
                    external analytics tools needed. Once your funnel starts
                    receiving visits, performance insights and drop-off
                    flagging will appear here.
                  </>
                ),
                meta: 'No traffic yet',
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
      <div className="px-4 py-6 md:px-10 md:py-10">
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
      <div className="px-4 py-6 md:px-10 md:py-10">
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
