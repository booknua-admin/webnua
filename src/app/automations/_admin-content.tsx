'use client';

import { useMemo, useState } from 'react';

import { AutomationGroup } from '@/components/admin/automations/AutomationGroup';
import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  useAdminAutomations,
  useToggleAutomation,
} from '@/lib/automations/queries';
import { normalizeError } from '@/lib/errors';

function AdminAutomationsContent() {
  const { data: page, isLoading, error } = useAdminAutomations();
  const toggle = useToggleAutomation();
  const [activeClient, setActiveClient] = useState('all');

  const groups = useMemo(() => page?.groups ?? [], [page]);

  // Client-chip counts = total flows per client across every group.
  const clientFilters = useMemo(
    () =>
      (page?.filters ?? []).map((chip) => ({
        ...chip,
        count:
          chip.id === 'all'
            ? groups.reduce((n, g) => n + g.flows.length, 0)
            : groups.reduce(
                (n, g) =>
                  n + g.flows.filter((f) => f.clientTone === chip.id).length,
                0,
              ),
      })),
    [page, groups],
  );

  // Filtering narrows each group's flows to the active client and drops
  // groups with nothing left; the count badge is recomputed to match.
  const visibleGroups = useMemo(() => {
    if (activeClient === 'all') return groups;
    return groups
      .map((group) => {
        const flows = group.flows.filter(
          (f) => f.clientTone === activeClient,
        );
        const enabled = flows.filter((f) => f.enabled).length;
        return { ...group, flows, countBadge: `${enabled} / ${flows.length}` };
      })
      .filter((group) => group.flows.length > 0);
  }, [activeClient, groups]);

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

            <FilterChips
              label="// CLIENT"
              chips={clientFilters}
              value={activeClient}
              onChange={setActiveClient}
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
