'use client';

import { useId } from 'react';

import type {
  AutomationEditableFilterField,
  AutomationEditableTriggerField,
} from '@/lib/automations/types';
import { cn } from '@/lib/utils';

type AutomationTriggerEditorProps = {
  /** Editable trigger config fields the automation's trigger type carries
   *  (delay_minutes / days_after_last_outbound / to_status / etc.). */
  triggerFields: AutomationEditableTriggerField[];
  /** Editable trigger filter fields (requires_phone / requires_email /
   *  requires_gbp_location). */
  filterFields: AutomationEditableFilterField[];
  /** Called on every field change with the FULL next jsonb payload. The
   *  parent owns the "save" lifecycle. */
  onChangeTrigger: (field: AutomationEditableTriggerField) => void;
  onChangeFilter: (field: AutomationEditableFilterField) => void;
  /** Drives the read-only treatment for client-role users. */
  readOnly?: boolean;
};

/**
 * Trigger-config + filter editor mounted between the TriggerBox and the
 * first step. Phase 8 Session 2 — gives operators a small form to tune
 * the delay before a review request, the cold-lead threshold, the booking
 * status that fires the on-the-way SMS, etc.
 *
 * Empty trigger + empty filter set renders nothing (some triggers — like
 * `payment_failed` — have no editable fields).
 */
function AutomationTriggerEditor({
  triggerFields,
  filterFields,
  onChangeTrigger,
  onChangeFilter,
  readOnly = false,
}: AutomationTriggerEditorProps) {
  if (triggerFields.length === 0 && filterFields.length === 0) return null;

  return (
    <div className="rounded-[10px] border border-rule bg-card">
      <div className="border-b border-paper-2 bg-paper px-5.5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        {'// Trigger settings'}
      </div>
      <div className="grid grid-cols-1 gap-4 px-5.5 py-4 md:grid-cols-2">
        {triggerFields.map((field) => (
          <TriggerFieldEditor
            key={field.kind}
            field={field}
            onChange={onChangeTrigger}
            readOnly={readOnly}
          />
        ))}
        {filterFields.map((field) => (
          <FilterFieldEditor
            key={field.kind}
            field={field}
            onChange={onChangeFilter}
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
      return (
        <label htmlFor={id} className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
            {field.label}
          </span>
          <select
            id={id}
            value={field.value}
            disabled={readOnly}
            onChange={(e) => onChange({ ...field, value: e.target.value })}
            className={cn(
              'h-10 rounded-md border border-rule bg-paper px-3 font-sans text-[14px] font-semibold text-ink outline-none focus:border-rust',
              readOnly && 'opacity-65',
            )}
          >
            {field.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      );
    }
  }
}

function FilterFieldEditor({
  field,
  onChange,
  readOnly,
}: {
  field: AutomationEditableFilterField;
  onChange: (next: AutomationEditableFilterField) => void;
  readOnly: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-paper px-3 py-2.5"
    >
      <input
        id={id}
        type="checkbox"
        checked={field.value}
        disabled={readOnly}
        onChange={(e) => onChange({ ...field, value: e.target.checked })}
        className="mt-[3px] size-4 cursor-pointer"
      />
      <span className="flex-1 font-sans text-[13px] leading-[1.4] text-ink">
        {field.label}
      </span>
    </label>
  );
}

export { AutomationTriggerEditor };
export type { AutomationTriggerEditorProps };
