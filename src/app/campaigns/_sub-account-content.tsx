'use client';

import { LaunchMetaCampaignButton } from '@/components/admin/campaigns/LaunchMetaCampaignButton';
import { CampaignActivityCard } from '@/components/shared/campaigns/CampaignActivityCard';
import { CampaignHeroCard } from '@/components/shared/campaigns/CampaignHeroCard';
import { CampaignTrendChart } from '@/components/shared/campaigns/CampaignTrendChart';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { normalizeError } from '@/lib/errors';
import { useSubAccountCampaigns } from '@/lib/campaigns/queries';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

/**
 * Operator-in-sub-account campaigns view — drilled into one client.
 *
 * Mirrors the client deep-dive shape (`CampaignHeroCard` + `CampaignTrendChart`
 * + `CampaignActivityCard`) fed by `useSubAccountCampaigns(clientSlug)`. The
 * client-facing reassurance blocks (`CampaignManagedBand` / `CampaignChangeCard`
 * "text Craig" CTAs) are intentionally dropped — they exist to tell a CLIENT
 * that Webnua manages the work; the operator IS Webnua.
 *
 * Operator chrome lives in a top-of-page action strip (mirror of
 * `admin/hub/OperatorActionBar` from the dashboard hub — see
 * reference/client-context-pattern.md §7 recommendation 3). The strip hosts
 * `LaunchMetaCampaignButton` which already exposes BOTH launch + sync.
 *
 * The existing `CampaignMetricTile` row inside `CampaignHeroCard` IS the stats
 * surface (Flavour A of the stats pattern — §6 + §7 recommendation 2). No
 * separate 4-up `StatCard` row is bolted on top.
 *
 * No `ClientMultiSelect`, no `WorkspaceContextBanner` (the hero leads with
 * the client name).
 */
function SubAccountCampaignsContent() {
  const activeClient = useActiveClient();
  const { activeClientId } = useWorkspace();
  const { data: page, isLoading, error } = useSubAccountCampaigns(activeClientId);

  const clientName = activeClient?.name ?? 'this client';

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={[clientName]} current="Campaigns" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <OperatorActionStrip />
        {isLoading ? (
          <CampaignsNotice>{'// Loading campaigns…'}</CampaignsNotice>
        ) : error || !page ? (
          <CampaignsNotice>
            {`// ${error ? normalizeError(error).message : 'Campaigns unavailable'}`}
          </CampaignsNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={page.hero.eyebrow}
              title={page.hero.title}
              subtitle={page.hero.subtitle}
            />
            <CampaignHeroCard data={page.active} />
            {page.trend ? (
              <CampaignTrendChart data={page.trend} />
            ) : (
              <div className="rounded-xl border border-dashed border-rule bg-paper px-7 py-8 text-center">
                <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
                  {'// LEADS VS SPEND · AWAITING META ADS'}
                </p>
                <p className="mx-auto max-w-[460px] text-[13px] text-ink-soft">
                  The weekly leads-vs-spend trend appears here once this
                  client&apos;s Meta ad account is connected and an active
                  campaign is running.
                </p>
              </div>
            )}
            <CampaignActivityCard data={page.activity} />
          </>
        )}
      </div>
    </>
  );
}

/**
 * Operator action strip — visual + structural mirror of
 * `admin/hub/OperatorActionBar`, but hosts the stateful
 * `LaunchMetaCampaignButton` (launch + sync) instead of typed
 * `OperatorAction[]` chips. The two affordances together are the operator's
 * cross-app entry into Meta — pause/resume per-campaign happens in Ads Manager
 * (V1 model: Webnua doesn't build / mutate campaigns in-app; sync pulls the
 * Ads-Manager state back).
 */
function OperatorActionStrip() {
  return (
    <div
      data-slot="operator-action-strip"
      className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[10px] border border-rule bg-paper-2 px-5 py-3"
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
        {'// Operator actions'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <LaunchMetaCampaignButton />
      </div>
      <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Viewing as operator · the client sees this screen without this bar
      </span>
    </div>
  );
}

function CampaignsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { SubAccountCampaignsContent };
