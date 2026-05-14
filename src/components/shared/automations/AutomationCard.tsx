'use client';

import { useState } from 'react';

import { Switch } from '@/components/ui/switch';
import type { Automation, AutomationStep } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

type AutomationCardProps = {
  automation: Automation;
};

function AutomationCard({ automation }: AutomationCardProps) {
  const [enabled, setEnabled] = useState(automation.enabled);

  return (
    <div
      data-slot="auto-card"
      data-enabled={enabled}
      className={cn(
        'overflow-hidden rounded-xl border border-rule bg-card transition-all',
        !enabled && 'bg-paper-2 opacity-65',
      )}
    >
      <div
        data-slot="auto-card-header"
        className="flex items-start justify-between gap-4 px-5.5 py-5"
      >
        <div className="flex-1">
          <div
            data-slot="auto-card-tag"
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
          <div className="max-w-[580px] font-sans text-[14px] leading-[1.5] text-ink-quiet [&_strong]:font-semibold [&_strong]:text-ink">
            {automation.description}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            label={enabled ? 'ON' : 'OFF'}
          />
        </div>
      </div>

      {enabled ? (
        <div
          data-slot="auto-card-body"
          className="border-t border-paper-2 bg-paper"
        >
          <div
            data-slot="auto-trigger-row"
            className="flex items-center gap-3.5 bg-ink px-5.5 py-3.5 text-paper"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rust font-mono text-[12px] font-extrabold text-paper">
              ⚡
            </div>
            <div className="flex-1">
              <div className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-paper/50">
                {'// TRIGGER'}
              </div>
              <div className="font-sans text-[14px] font-bold text-paper">
                {automation.trigger}
              </div>
            </div>
          </div>
          <div data-slot="auto-step-list">
            {automation.steps.map((step) => (
              <AutomationStepItem key={step.number} step={step} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AutomationStepItem({ step }: { step: AutomationStep }) {
  return (
    <div
      data-slot="auto-step-item"
      className="border-b border-paper-2 bg-card px-5.5 py-4.5 last:border-b-0"
    >
      <div
        data-slot="auto-step-meta-row"
        className="mb-3 flex items-center gap-3"
      >
        <div className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-extrabold text-rust-light">
          {step.number}
        </div>
        <div
          data-slot="auto-step-channel"
          data-channel={step.channel}
          className={cn(
            'rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
            step.channel === 'sms'
              ? 'bg-good/12 text-good'
              : 'bg-info/14 text-info',
          )}
        >
          {step.channel === 'sms' ? 'SMS' : 'Email'}
        </div>
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-quiet [&_strong]:text-ink">
          {step.delay}
        </div>
        <span className="ml-auto cursor-pointer font-sans text-[12px] font-bold text-rust">
          Edit copy ✎
        </span>
      </div>
      <div
        data-slot="auto-step-copy-box"
        className={cn(
          'rounded-md border px-3.5 py-3 font-sans text-[13px] leading-[1.5] text-ink',
          step.isEditing
            ? 'border-rust bg-rust-soft/60'
            : 'border-rule bg-paper',
          '[&_[data-slot=var]]:rounded-[4px] [&_[data-slot=var]]:bg-rust/12 [&_[data-slot=var]]:px-1.5 [&_[data-slot=var]]:py-0.5 [&_[data-slot=var]]:font-mono [&_[data-slot=var]]:text-[11px] [&_[data-slot=var]]:font-semibold [&_[data-slot=var]]:text-rust',
        )}
      >
        {step.body}
      </div>
      {step.meta ? (
        <div
          data-slot="auto-step-meta-bar"
          className="mt-2 flex gap-3.5 px-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet [&_strong]:text-ink"
        >
          {step.meta.map((m) => (
            <div key={m.label}>
              {m.label}: <strong>{m.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { AutomationCard };
