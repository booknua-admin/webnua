'use client';

import { useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { AutomationStatsCard as AutomationStatsCardData } from '@/lib/automations/types';

import { AutomationStatTile } from './AutomationStatTile';

type AutomationStatsCardProps = {
  automation: AutomationStatsCardData;
};

function AutomationStatsCard({ automation }: AutomationStatsCardProps) {
  const [enabled, setEnabled] = useState(automation.enabled);
  const stats = automation.stats;

  return (
    <div
      data-slot="automation-stats-card"
      data-enabled={enabled}
      className={cn(
        'overflow-hidden rounded-xl border border-rule bg-card transition-all',
        !enabled && 'bg-paper-2 opacity-65',
      )}
    >
      <div
        data-slot="automation-stats-card-header"
        className="flex items-start justify-between gap-4 px-5.5 py-5"
      >
        <div className="flex-1">
          <div
            className={cn(
              'mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
              enabled ? 'text-rust' : 'text-ink-quiet',
            )}
          >
            {automation.tag}
          </div>
          <div className="mb-1.5 font-sans text-[20px] font-extrabold leading-tight tracking-[-0.025em] text-ink">
            {automation.title}
          </div>
          <div className="max-w-[640px] font-sans text-[14px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {automation.description}
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          label={enabled ? 'ON' : 'OFF'}
        />
      </div>

      {enabled && stats && stats.length > 0 ? (
        <div
          data-slot="automation-stats-card-stats"
          className="grid grid-cols-4 gap-2.5 border-t border-paper-2 bg-paper-2/40 p-3.5"
        >
          {stats.map((stat) => (
            <AutomationStatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { AutomationStatsCard };
export type { AutomationStatsCardProps };
