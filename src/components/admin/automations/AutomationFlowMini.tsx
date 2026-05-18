import Link from 'next/link';

import { Switch } from '@/components/ui/switch';
import { CLIENT_TONE_BG } from '@/lib/clients/tones';
import { cn } from '@/lib/utils';
import type { AutomationFlowMini as AutomationFlowMiniData } from '@/lib/automations/types';

type AutomationFlowMiniProps = {
  flow: AutomationFlowMiniData;
  className?: string;
};

function AutomationFlowMini({ flow, className }: AutomationFlowMiniProps) {
  const toneBg = flow.clientTone
    ? CLIENT_TONE_BG[flow.clientTone]
    : CLIENT_TONE_BG.generic;

  const rowClasses = cn(
    'grid grid-cols-[36px_minmax(180px,1fr)_repeat(3,90px)_56px] items-center gap-3.5 border-b border-paper-2 px-4 py-3 last:border-b-0 transition-colors',
    flow.enabled
      ? 'bg-card hover:bg-paper-2/40'
      : 'bg-paper-2/30 text-ink-quiet',
    flow.href && flow.enabled && 'cursor-pointer',
    className,
  );

  const logo = (
    <div
      data-slot="automation-flow-mini-logo"
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-[8px] font-sans text-[13px] font-extrabold text-paper',
        toneBg,
        !flow.enabled && 'opacity-60',
      )}
    >
      {flow.clientInitial}
    </div>
  );

  const info = (
    <div className="min-w-0">
      <div className="font-sans text-[14px] font-bold text-ink">
        {flow.clientName}
      </div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {flow.flowName}
      </div>
    </div>
  );

  const metrics = flow.stats.slice(0, 3).map((stat) => (
    <div
      key={stat.label}
      data-slot="automation-flow-mini-metric"
      className="flex flex-col gap-0.5"
    >
      <div
        className={cn(
          'font-sans text-[16px] font-extrabold leading-none tracking-[-0.02em]',
          flow.enabled ? 'text-ink' : 'text-ink-quiet',
        )}
      >
        {stat.value}
      </div>
      <div className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {stat.label}
      </div>
    </div>
  ));

  const toggle = (
    <div
      className="flex justify-end"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <Switch defaultChecked={flow.enabled} />
    </div>
  );

  const body = (
    <>
      {logo}
      {info}
      {metrics}
      {toggle}
    </>
  );

  if (flow.href && flow.enabled) {
    return (
      <Link
        href={flow.href}
        data-slot="automation-flow-mini"
        data-enabled={flow.enabled}
        className={rowClasses}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      data-slot="automation-flow-mini"
      data-enabled={flow.enabled}
      className={rowClasses}
    >
      {body}
    </div>
  );
}

export { AutomationFlowMini };
export type { AutomationFlowMiniProps };
