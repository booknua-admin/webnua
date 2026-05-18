'use client';

import { AutomationInfoBanner } from '@/components/shared/automations/AutomationInfoBanner';
import { AutomationStatsCard } from '@/components/shared/automations/AutomationStatsCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { Topbar, TopbarBreadcrumb } from '@/components/shared/Topbar';
import {
  useClientAutomations,
  useToggleAutomation,
} from '@/lib/automations/queries';
import { normalizeError } from '@/lib/errors';

function ClientAutomationsContent() {
  const { data: page, isLoading, error } = useClientAutomations();
  const toggle = useToggleAutomation();

  return (
    <>
      <Topbar
        breadcrumb={
          <TopbarBreadcrumb trail={['Home']} current="Automations" />
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
            <AutomationInfoBanner>{page.banner}</AutomationInfoBanner>
            <div className="flex flex-col gap-3.5">
              {page.cards.map((automation) => (
                <AutomationStatsCard
                  key={automation.id}
                  automation={automation}
                  onToggle={(enabled) =>
                    toggle.mutate({ id: automation.id, enabled })
                  }
                />
              ))}
            </div>
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

export { ClientAutomationsContent };
