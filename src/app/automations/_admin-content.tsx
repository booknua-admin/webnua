'use client';

import { useMemo } from 'react';

import { AutomationGroup } from '@/components/admin/automations/AutomationGroup';
import { useAutomationGbpGuard } from '@/components/shared/automations/AutomationGbpGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  useAdminAutomations,
  useToggleAutomation,
} from '@/lib/automations/queries';
import { normalizeError } from '@/lib/errors';

/**
 * Operator agency-mode automations roster — cross-client, grouped by trigger
 * type.
 *
 * The sidebar `AdminClientPicker` is canonical for narrowing scope; the
 * in-page `ClientMultiSelect` was dropped (Phase 9b · Session 2). When an
 * operator drills into a client the `/automations` dispatcher hands off to
 * `_sub-account-content.tsx` instead.
 */
function AdminAutomationsContent() {
  const { data: page, isLoading, error } = useAdminAutomations();
  const toggle = useToggleAutomation();
  const { guardEnable, GbpGuardDialog } = useAutomationGbpGuard();

  const groups = useMemo(() => page?.groups ?? [], [page]);

  const handleToggleFlow = (id: string, enabled: boolean) => {
    const fire = () => toggle.mutate({ id, enabled });
    if (!enabled) {
      fire();
      return;
    }
    // Find the row we're enabling so we can read its GBP prereq.
    for (const g of groups) {
      const f = g.flows.find((flow) => flow.id === id);
      if (f) {
        guardEnable(
          { clientId: f.clientId, requiresGbpLocation: f.requiresGbpLocation },
          fire,
        );
        return;
      }
    }
    fire();
  };

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Automations" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
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

            <div className="grid grid-cols-4 gap-3.5">
              {page.stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  trend={stat.trend}
                  trendTone={stat.trendTone}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3.5">
              {groups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// No automations configured'}
                </div>
              ) : (
                groups.map((group) => (
                  <AutomationGroup
                    key={group.id}
                    group={group}
                    onToggleFlow={handleToggleFlow}
                  />
                ))
              )}
            </div>
            <GbpGuardDialog />
          </>
        )}
      </div>
    </>
  );
}

function AutomationsNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-rule bg-card px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
      {children}
    </p>
  );
}

export { AdminAutomationsContent };
