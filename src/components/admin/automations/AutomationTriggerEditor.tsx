'use client';

import { useId } from 'react';

import type {
  AutomationEditableTriggerField,
} from '@/lib/automations/types';
import { cn } from '@/lib/utils';

type AutomationTriggerEditorProps = {
  /** Editable trigger config fields the automation's trigger type carries
   *  (delay_minutes / days_after_last_outbound / max_nudges). */
  triggerFields: AutomationEditableTriggerField[];
  /** Called on every field change. The parent owns the "save" lifecycle. */
  onChangeTrigger: (field: AutomationEditableTriggerField) => void;
  /** Drives the read-only treatment for client-role users. */
  readOnly?: boolean;
};

/**
 * Cadence editor mounted between the TriggerBox and the first step.
 *
 * Reframed in the client-vs-operator split: the previous `requires_*`
 * filter checkboxes are system invariants (a review-request automation
 * needs a phone / a GBP listing — these are facts of the integration,
 * not operator opinion), so they're hidden in the UI; the underlying
 * `trigger_filters` jsonb still persists and the runtime engine honours
 * them. `to_status` is hidden because editing it would silently change
 * what the automation IS — clone to change instead.
 *
 * Remaining editable knobs: `delay_minutes` (how long to wait before the
 * automation fires), `days_after_last_outbound` (cold-lead threshold),
 * `max_nudges` (cold-lead nudge cap). When the underlying automation has
 * NO editable cadence field, the section is suppressed entirely.
 */
function AutomationTriggerEditor({
  triggerFields,
  onChangeTrigger,
  readOnly = false,
}: AutomationTriggerEditorProps) {
  const visibleFields = triggerFields.filter(
    (f) => f.kind !== 'to_status',
  );
  if (visibleFields.length === 0) return null;

  return (
    <div className="rounded-[10px] border border-rule bg-card">
      <div className="border-b border-paper-2 bg-paper px-5.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {'// Cadence'}
      </div>
      <div className="grid grid-cols-1 gap-4 px-5.5 py-4 md:grid-cols-2">
        {visibleFields.map((field) => (
          <TriggerFieldEditor
            key={field.kind}
            field={field}
            onChange={onChangeTrigger}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function TriggerFieldEditor({
  field,
  onChange,
  readOnly,
}: {
  field: AutomationEditableTriggerField;
  onChange: (next: AutomationEditableTriggerField) => void;
  readOnly: boolean;
}) {
  const id = useId();
  switch (field.kind) {
    case 'delay_minutes':
    case 'days_after_last_outbound':
    case 'max_nudges': {
      return (
        <label htmlFor={id} className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
            {field.label}
          </span>
          <input
            id={id}
            type="number"
            min={field.min}
            max={field.max}
            value={field.value}
            disabled={readOnly}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              const clamped = Math.max(field.min, Math.min(field.max, n));
              onChange({ ...field, value: clamped });
            }}
            className={cn(
              'h-10 rounded-md border border-rule bg-paper px-3 font-sans text-[14px] font-semibold text-ink outline-none focus:border-rust',
              readOnly && 'opacity-65',
            )}
          />
        </label>
      );
    }
    case 'to_status': {
      // Hidden in the UI — editing the booking-status target would silently
      // change what the automation IS (an on-the-way SMS vs an arrived SMS).
      // The data stays on `trigger_config.to_status`; clone to change.
      return null;
    }
  }
}

export { AutomationTriggerEditor };
export type { AutomationTriggerEditorProps };
