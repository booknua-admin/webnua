'use client';

import type { AutomationEditorStep as AutomationEditorStepData } from '@/lib/automations/types';
import { cn } from '@/lib/utils';

/** Patch emitted as the operator edits a step's copy. */
export type AutomationStepPatch = {
  name?: string;
  subject?: string;
  bodyText?: string;
};

type AutomationEditorStepProps = {
  step: AutomationEditorStepData;
  /** Called on every keystroke in the step's name / subject / body fields. */
  onChange: (patch: AutomationStepPatch) => void;
};

function AutomationEditorStep({ step, onChange }: AutomationEditorStepProps) {
  return (
    <div
      data-slot="automation-editor-step"
      data-editing={step.isEditing ? 'true' : 'false'}
      className={cn(
        'overflow-hidden rounded-[10px] border bg-card transition-all',
        step.isEditing
          ? 'border-2 border-rust shadow-[0_0_0_4px_rgba(212,67,23,0.1)]'
          : 'border border-rule',
      )}
    >
      <div
        data-slot="automation-editor-step-header"
        className={cn(
          'grid grid-cols-[26px_auto_auto_1fr_auto_auto] items-center gap-3 border-b px-4.5 py-3.5',
          step.isEditing
            ? 'border-rust bg-rust-soft/55'
            : 'border-paper-2 bg-paper',
        )}
      >
        <div className="flex size-6.5 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-extrabold text-rust-light">
          {step.number}
        </div>
        <span
          data-channel={step.channel}
          className={cn(
            'rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
            step.channel === 'sms'
              ? 'bg-good/12 text-good'
              : 'bg-info/14 text-info',
          )}
        >
          {step.channel === 'sms' ? 'SMS' : 'Email'}
        </span>
        <button
          type="button"
          data-slot="automation-step-delay-pill"
          className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.06em] text-ink"
        >
          <span aria-hidden className="text-ink-quiet">
            ◷
          </span>
          {step.delay}
        </button>
        <input
          type="text"
          value={step.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="min-w-0 border-none bg-transparent font-sans text-[14px] font-bold text-ink outline-none placeholder:text-ink-quiet"
          aria-label="Step name"
        />
        <StepIconBtn label="Reorder">↕</StepIconBtn>
        <StepIconBtn label="Delete" danger>
          ×
        </StepIconBtn>
      </div>

      <div data-slot="automation-editor-step-body" className="px-5.5 py-4.5">
        {step.channel === 'email' ? (
          <input
            type="text"
            value={step.subject ?? ''}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Subject…"
            aria-label="Email subject"
            className="mb-2.5 w-full rounded-md border border-rule bg-paper px-3.5 py-2.5 font-sans text-[13px] font-semibold text-ink outline-none focus:border-rust"
          />
        ) : null}
        <textarea
          data-slot="automation-editor-step-body-text"
          value={step.bodyText ?? ''}
          onChange={(e) => onChange({ bodyText: e.target.value })}
          aria-label="Message body"
          rows={4}
          className={cn(
            'block min-h-24 w-full resize-y whitespace-pre-wrap rounded-md border px-4 py-3.5 font-sans text-[14px] leading-[1.55] text-ink outline-none',
            step.isEditing
              ? 'border-rust bg-card shadow-[0_0_0_3px_rgba(212,67,23,0.12)]'
              : 'border-rule bg-paper focus:border-rust',
          )}
        />
      </div>

      <div
        data-slot="automation-editor-step-footer"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-2 bg-paper px-5.5 py-3"
      >
        <span
          className={cn(
            'font-mono text-[10px] font-bold uppercase tracking-[0.08em]',
            step.isEditing ? 'text-rust' : 'text-ink-quiet',
          )}
        >
          {step.footerMeta}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-slot="automation-var-hint"
            className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet"
          >
            Variables:
          </span>
          {step.variables.map((v) => (
            <span
              key={v}
              data-slot="automation-var-chip"
              className="inline-flex items-center rounded-[4px] bg-rust/12 px-2 py-0.5 font-mono text-[10px] font-bold text-rust"
            >
              {v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepIconBtn({
  children,
  label,
  danger = false,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex size-7 items-center justify-center rounded-md border border-rule bg-card font-mono text-[13px] text-ink-quiet transition-colors',
        danger
          ? 'hover:border-warn hover:bg-warn hover:text-paper'
          : 'hover:border-ink hover:bg-ink hover:text-paper',
      )}
    >
      {children}
    </button>
  );
}

export { AutomationEditorStep };
export type { AutomationEditorStepProps };
