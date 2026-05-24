'use client';

import { useMemo } from 'react';

import { useAutomationGbpGuard } from '@/components/shared/automations/AutomationGbpGuard';
import { AutomationInfoBanner } from '@/components/shared/automations/AutomationInfoBanner';
import { AutomationStatsCard } from '@/components/shared/automations/AutomationStatsCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  useAutomationStatsBatch,
  useSubAccountAutomations,
  useToggleAutomation,
} from '@/lib/automations/queries';
import type {
  AutomationStat,
  AutomationStatsCard as AutomationStatsCardData,
} from '@/lib/automations/types';
import { normalizeError } from '@/lib/errors';
import { relativeTime } from '@/lib/time';
import { useActiveClient, useWorkspace } from '@/lib/workspace/workspace-stub';

/**
 * Operator-in-sub-account automations view — drilled into one client.
 *
 * Renders the stats-cards-per-flow pattern (see
 * `reference/client-context-pattern.md` §6): the existing
 * `AutomationStatsCard` shape, one per flow, with the per-card stats grid
 * populated from a batched 30-day `automation_runs` aggregation. Each card
 * click-throughs to `/automations/[id]` (the editor); operator can toggle
 * flows on/off with the same GBP-prereq guard client users see.
 *
 * No `ClientMultiSelect` (sidebar picker is canonical), no
 * `WorkspaceContextBanner` (the hero already carries the client name).
 */
function SubAccountAutomationsContent() {
  const activeClient = useActiveClient();
  const { activeClientId } = useWorkspace();
  const {
    data: page,
    isLoading,
    error,
  } = useSubAccountAutomations(activeClientId);
  const toggle = useToggleAutomation();
  const { guardEnable, GbpGuardDialog } = useAutomationGbpGuard();

  const automationIds = useMemo(
    () => (page?.cards ?? []).map((c) => c.id),
    [page?.cards],
  );
  const { data: statsByAutomation } = useAutomationStatsBatch(automationIds);

  // Merge the batched per-flow stats into each card's stats slot — the
  // visual pattern is "header on top, stats grid below" (the existing
  // `AutomationStatsCard` already supports this via the optional `stats`
  // prop). Disabled cards hide the grid via the card's own `enabled` check.
  const cardsWithStats: AutomationStatsCardData[] = useMemo(
    () =>
      (page?.cards ?? []).map((card) => {
        const stats = statsByAutomation?.get(card.id);
        if (!stats) return card;
        const tiles: AutomationStat[] = [
          {
            label: '// LAST FIRED',
            value: stats.lastFiredAt ? relativeTime(stats.lastFiredAt) : '—',
          },
          { label: '// RUNS · 30D', value: String(stats.totalRuns) },
          { label: '// COMPLETED', value: String(stats.completedRuns) },
          {
            label: '// COMPLETION',
            value:
              stats.totalRuns === 0 ? '—' : `${stats.completionRate}%`,
          },
        ];
        return { ...card, stats: tiles };
      }),
    [page?.cards, statsByAutomation],
  );

  const clientName = activeClient?.name ?? 'this client';

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={[clientName]} current="Automations" />
        }
      />
      <div className="flex flex-col gap-5 px-4 py-6 md:px-10 md:py-10">
        {isLoading ? (
          <AutomationsNotice>{'// Loading automations…'}</AutomationsNotice>
        ) : error || !page ? (
          <AutomationsNotice>
            {`// ${error ? normalizeError(error).message : 'Automations unavailable'}`}
          </AutomationsNotice>
        ) : (
          <>
            <PageHeader
              eyebrow={page.hero.eyebrow}
              title={page.hero.title}
              subtitle={page.hero.subtitle}
            />
            <AutomationInfoBanner>{page.banner}</AutomationInfoBanner>
            {cardsWithStats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                {'// No automations for this client'}
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {cardsWithStats.map((automation) => (
                  <AutomationStatsCard
                    key={automation.id}
                    automation={automation}
                    onToggle={(enabled) => {
                      const fire = () =>
                        toggle.mutate({ id: automation.id, enabled });
                      if (enabled) {
                        guardEnable(
                          {
                            clientId: automation.clientId,
                            requiresGbpLocation: automation.requiresGbpLocation,
                          },
                          fire,
                        );
                      } else {
                        fire();
                      }
                    }}
                  />
                ))}
              </div>
            )}
            <GbpGuardDialog />
          </>
        )}
      </div>
    </>
  );
}

function AutomationsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-rule bg-card px-5.5 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { SubAccountAutomationsContent };
