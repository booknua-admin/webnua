import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { AutomationGroup as AutomationGroupData } from '@/lib/automations/types';

import { AutomationFlowMini } from './AutomationFlowMini';

type AutomationGroupProps = {
  group: AutomationGroupData;
  className?: string;
};

function AutomationGroup({ group, className }: AutomationGroupProps) {
  return (
    <div
      data-slot="automation-group"
      className={cn(
        'overflow-hidden rounded-xl border border-rule bg-card',
        className,
      )}
    >
      <AutomationGroupHeader
        title={group.title}
        countBadge={group.countBadge}
        meta={group.meta}
      />
      <div data-slot="automation-group-rows">
        {group.flows.map((flow) => (
          <AutomationFlowMini key={flow.id} flow={flow} />
        ))}
      </div>
    </div>
  );
}

function AutomationGroupHeader({
  title,
  countBadge,
  meta,
}: {
  title: string;
  countBadge: string;
  meta: ReactNode;
}) {
  return (
    <div
      data-slot="automation-group-header"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-2 bg-paper-2/50 px-4 py-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="font-sans text-[15px] font-extrabold tracking-[-0.02em] text-ink">
          {title}
        </div>
        <span
          data-slot="automation-group-count-badge"
          className="inline-flex items-center rounded-full bg-ink/8 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet"
        >
          {countBadge}
        </span>
      </div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet [&_strong]:text-ink">
        {meta}
      </div>
    </div>
  );
}

export { AutomationGroup };
export type { AutomationGroupProps };
