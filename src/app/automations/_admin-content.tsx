'use client';

import { useMemo, useState } from 'react';

import { AutomationGroup } from '@/components/admin/automations/AutomationGroup';
import { ClientMultiSelect } from '@/components/shared/ClientMultiSelect';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { WorkspaceContextBanner } from '@/components/shared/WorkspaceContextBanner';
import {
  useAdminAutomations,
  useToggleAutomation,
} from '@/lib/automations/queries';
import { normalizeError } from '@/lib/errors';
import { useIsAgencyMode, useWorkspace } from '@/lib/workspace/workspace-stub';

function AdminAutomationsContent() {
  const { data: page, isLoading, error } = useAdminAutomations();
  const toggle = useToggleAutomation();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const groups = useMemo(() => page?.groups ?? [], [page]);

  // Workspace context: agency mode → cross-client roster + the multi-select
  // filter; sub-account mode → the page scopes to the picked client.
  const isAgency = useIsAgencyMode();
  const { activeClientId } = useWorkspace();
  const effectiveClients = useMemo(
    () => (isAgency || !activeClientId ? selectedClients : [activeClientId]),
    [isAgency, activeClientId, selectedClients],
  );

  // Per-client flow counts across every group, keyed on client slug.
  const clientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of groups) {
      for (const f of g.flows) {
        counts[f.clientSlug] = (counts[f.clientSlug] ?? 0) + 1;
      }
    }
    return counts;
  }, [groups]);

  // Filtering narrows each group's flows to the selected clients and drops
  // groups with nothing left; the count badge is recomputed to match.
  const visibleGroups = useMemo(() => {
    if (effectiveClients.length === 0) return groups;
    return groups
      .map((group) => {
        const flows = group.flows.filter((f) =>
          effectiveClients.includes(f.clientSlug),
        );
        const enabled = flows.filter((f) => f.enabled).length;
        return { ...group, flows, countBadge: `${enabled} / ${flows.length}` };
      })
      .filter((group) => group.flows.length > 0);
  }, [effectiveClients, groups]);

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

            {isAgency ? (
              <ClientMultiSelect
                label="// CLIENT"
                value={selectedClients}
                onChange={setSelectedClients}
                counts={clientCounts}
              />
            ) : (
              <WorkspaceContextBanner />
            )}

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
              {visibleGroups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-rule bg-paper px-10 py-12 text-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-quiet">
                  {'// No automations for this client'}
                </div>
              ) : (
                visibleGroups.map((group) => (
                  <AutomationGroup
                    key={group.id}
                    group={group}
                    onToggleFlow={(id, enabled) =>
                      toggle.mutate({ id, enabled })
                    }
                  />
                ))
              )}
            </div>
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
