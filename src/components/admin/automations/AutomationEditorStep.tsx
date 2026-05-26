'use client';

import { useId, useMemo } from 'react';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { MAX_TEMPLATE_LENGTH } from '@/lib/sms/default-templates';
import { validateTemplate } from '@/lib/sms/character-validator';
import type { AutomationEditorStep as AutomationEditorStepData } from '@/lib/automations/types';
import { cn } from '@/lib/utils';

/** Patch emitted as the operator edits a step's copy. Phase 8 Session 2:
 *  separate fields for the email subject + HTML / text bodies, and the SMS
 *  body which lives on `bodyText`. */
export type AutomationStepPatch = {
  name?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
};

type AutomationEditorStepProps = {
  step: AutomationEditorStepData;
  /** Called on every keystroke in the step's editable fields. */
  onChange: (patch: AutomationStepPatch) => void;
  /** When true, the inputs render disabled + the helper bar reads "view
   *  only". Drives the client-role read-only treatment. */
  readOnly?: boolean;
};

function AutomationEditorStep({ step, onChange, readOnly = false }: AutomationEditorStepProps) {
  const nameId = useId();
  const subjectId = useId();
  const bodyId = useId();

  const isSms = step.actionKind === 'send_sms_to_lead';
  const isEmail = step.actionKind === 'send_email_to_lead';
  const isComm = isSms || isEmail;

  // SMS validator — runs only on SMS steps; renders character + segment
  // count + GSM warnings inline. The handler also re-validates at send
  // time so the editor's check is an informational nudge, not the gate.
  const smsValidation = useMemo(() => {
    if (!isSms || !step.bodyText) return null;
    return validateTemplate(step.bodyText);
  }, [isSms, step.bodyText]);

  return (
    <div
      data-slot="automation-editor-step"
      data-action-kind={step.actionKind}
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
          'grid grid-cols-[26px_auto_auto_1fr_auto] items-center gap-3 border-b px-4.5 py-3.5',
          step.isEditing
            ? 'border-rust bg-rust-soft/55'
            : 'border-paper-2 bg-paper',
        )}
      >
        <div className="flex size-6.5 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-extrabold text-rust-light">
          {step.number}
        </div>
        <ActionKindPill step={step} />
        <button
          type="button"
          data-slot="automation-step-delay-pill"
          className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-card px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.06em] text-ink"
          title="Step timing is fixed in V1 — V1.1 will surface a delay editor."
        >
          <span aria-hidden className="text-ink-quiet">◷</span>
          {step.delay}
        </button>
        <input
          id={nameId}
          type="text"
          value={step.name}
          onChange={(e) => onChange({ name: e.target.value })}
          disabled={readOnly || !step.canEditBody}
          className="min-w-0 rounded-sm border-none bg-transparent font-sans text-[14px] font-bold text-ink outline-none placeholder:text-ink-quiet focus-visible:bg-paper-2 focus-visible:ring-2 focus-visible:ring-rust/30 disabled:opacity-65"
          aria-label="Step name"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {readOnly ? 'view only' : step.canEditBody ? 'edit copy' : 'engine-managed'}
        </span>
      </div>

      <div data-slot="automation-editor-step-body" className="px-5.5 py-4.5">
        {isComm ? (
          <CapabilityGate
            capability="editForms"
            mode={readOnly ? 'disable' : 'request'}
            disabledExplainer="Editing the message body needs operator access. Ask your operator to update it for you."
          >
            <div className="flex flex-col gap-2.5">
              {isEmail ? (
                <input
                  id={subjectId}
                  type="text"
                  value={step.subject ?? ''}
                  onChange={(e) => onChange({ subject: e.target.value })}
                  placeholder="Subject…"
                  aria-label="Email subject"
                  disabled={readOnly}
                  className="w-full rounded-md border border-rule bg-paper px-3.5 py-2.5 font-sans text-[13px] font-semibold text-ink outline-none focus:border-rust focus-visible:ring-2 focus-visible:ring-rust/30 disabled:opacity-65"
                />
              ) : null}
              {isEmail ? (
                <textarea
                  id={bodyId}
                  data-slot="automation-editor-step-body-html"
                  value={step.bodyHtml ?? ''}
                  onChange={(e) => onChange({ bodyHtml: e.target.value })}
                  aria-label="Email HTML body"
                  rows={5}
                  disabled={readOnly}
                  spellCheck
                  className={cn(
                    'block min-h-28 w-full resize-y whitespace-pre-wrap rounded-md border px-4 py-3.5 font-sans text-[14px] leading-[1.55] text-ink outline-none focus-visible:ring-2 focus-visible:ring-rust/30 disabled:opacity-65',
                    step.isEditing
                      ? 'border-rust bg-card shadow-[0_0_0_3px_rgba(212,67,23,0.12)]'
                      : 'border-rule bg-paper focus:border-rust',
                  )}
                />
              ) : (
                <textarea
                  id={bodyId}
                  data-slot="automation-editor-step-body-text"
                  value={step.bodyText ?? ''}
                  onChange={(e) => onChange({ bodyText: e.target.value })}
                  aria-label="SMS body"
                  rows={4}
                  disabled={readOnly}
                  maxLength={MAX_TEMPLATE_LENGTH}
                  spellCheck
                  className={cn(
                    'block min-h-24 w-full resize-y whitespace-pre-wrap rounded-md border px-4 py-3.5 font-sans text-[14px] leading-[1.55] text-ink outline-none focus-visible:ring-2 focus-visible:ring-rust/30 disabled:opacity-65',
                    step.isEditing
                      ? 'border-rust bg-card shadow-[0_0_0_3px_rgba(212,67,23,0.12)]'
                      : 'border-rule bg-paper focus:border-rust',
                  )}
                />
              )}
              {isSms ? <SmsValidatorReadout validation={smsValidation} body={step.bodyText ?? ''} /> : null}
            </div>
          </CapabilityGate>
        ) : (
          <ReadOnlyActionSummary step={step} />
        )}
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
        {isComm ? (
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
        ) : null}
      </div>
    </div>
  );
}

// --- helpers ----------------------------------------------------------------

function ActionKindPill({ step }: { step: AutomationEditorStepData }) {
  if (step.actionKind === 'send_sms_to_lead') {
    return (
      <span
        data-channel="sms"
        className="rounded-full bg-good/12 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-good"
      >
        SMS
      </span>
    );
  }
  if (step.actionKind === 'send_email_to_lead') {
    return (
      <span
        data-channel="email"
        className="rounded-full bg-info/14 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-info"
      >
        Email
      </span>
    );
  }
  const label =
    step.actionKind === 'send_operator_notification'
      ? 'Operator alert'
      : step.actionKind === 'wait_for_duration'
      ? 'Wait'
      : step.actionKind === 'update_lead_field'
      ? 'Lead update'
      : 'Follow-up task';
  return (
    <span className="rounded-full bg-ink/8 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
      {label}
    </span>
  );
}

function ReadOnlyActionSummary({ step }: { step: AutomationEditorStepData }) {
  return (
    <div className="rounded-md border border-dashed border-rule bg-paper px-4 py-3.5 font-sans text-[13px] leading-[1.55] text-ink-soft">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {'// ENGINE-MANAGED · this step is configured by the platform'}
      </div>
      <div className="mt-1.5">{step.readOnlySummary}</div>
    </div>
  );
}

/** SMS validator readout: segment count + GSM warnings. Render-only — the
 *  send-time handler is the actual gate. */
function SmsValidatorReadout({
  validation,
  body,
}: {
  validation: ReturnType<typeof validateTemplate> | null;
  body: string;
}) {
  const length = body.length;
  const overLimit = length >= MAX_TEMPLATE_LENGTH;

  if (!validation) {
    return (
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        <span>0 chars · 0 segments</span>
        <span className={cn(overLimit && 'text-warn')}>
          {length} / {MAX_TEMPLATE_LENGTH} chars
        </span>
      </div>
    );
  }

  const encodingLabel = validation.segmentEncoding === 'gsm' ? 'GSM-7' : 'UCS-2';
  const segmentTone =
    validation.segments > 1 ? 'text-warn' : 'text-ink-quiet';
  const encodingTone =
    validation.segmentEncoding === 'ucs2' ? 'text-warn' : 'text-ink-quiet';

  const fixable = validation.warnings.some(
    (w) =>
      w.code === 'curly_quote' ||
      w.code === 'smart_dash' ||
      w.code === 'ellipsis' ||
      w.code === 'non_breaking_space',
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.08em]">
        <div className="flex items-center gap-3">
          <span className={encodingTone}>{encodingLabel}</span>
          <span className={segmentTone}>
            {validation.segments} segment{validation.segments === 1 ? '' : 's'}
          </span>
        </div>
        <span className={cn('text-ink-quiet', overLimit && 'text-warn')}>
          {length} / {MAX_TEMPLATE_LENGTH} chars
        </span>
      </div>
      {validation.warnings.length > 0 ? (
        <ul className="rounded-md border border-warn/40 bg-warn-soft/30 px-3 py-2 font-sans text-[12px] leading-[1.4] text-warn">
          {validation.warnings.map((w) => (
            <li key={w.code} className="flex items-start gap-2">
              <span aria-hidden className="mt-[2px] text-[10px]">⚠</span>
              <span>{w.message}</span>
            </li>
          ))}
          {fixable ? (
            <li className="mt-1 pt-1.5 border-t border-warn/30 font-mono text-[10px] uppercase tracking-[0.08em] text-warn">
              Tip: replacing smart quotes / em-dashes with plain ASCII keeps the
              SMS on the cheaper GSM-7 encoding.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export { AutomationEditorStep };
export type { AutomationEditorStepProps };
