import { AutomationGroup } from '@/components/admin/automations/AutomationGroup';
import { FilterChips } from '@/components/shared/FilterChips';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import { adminAutomations } from '@/lib/automations/admin-automations';

function AdminAutomationsContent() {
  const { hero, filters, defaultFilterId, stats, groups } = adminAutomations;
  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Workspace']} current="Automations" />
        }
      />
      <div className="flex flex-col gap-5 px-10 py-10">
        <PageHeader
          eyebrow={hero.eyebrow}
          title={hero.title}
          subtitle={hero.subtitle}
        />

        <FilterChips
          label="// CLIENT"
          chips={filters}
          defaultActiveId={defaultFilterId}
        />

        <div className="grid grid-cols-4 gap-3.5">
          {stats.map((stat) => (
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
          {groups.map((group) => (
            <AutomationGroup key={group.id} group={group} />
          ))}
        </div>
      </div>
    </>
  );
}

export { AdminAutomationsContent };
