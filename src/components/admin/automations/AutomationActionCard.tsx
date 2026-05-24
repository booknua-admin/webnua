'use client';

// =============================================================================
// AutomationActionCard — one editable action row inside the automation
// editor canvas. Phase 8 · Session 3.
//
// One card per `automation_actions` row, every action_type represented.
// The card header is always the same shape (position + type pill + name +
// reorder/delete buttons). The body is type-discriminated:
//   • send_sms_to_lead / send_email_to_lead → inline body textarea
//     (+ subject input for email) with click-to-insert variable chips.
//   • wait_for_duration → minutes input.
//   • update_lead_field → field select + value input.
//   • create_followup_task → optional hint input.
//   • send_operator_notification → variant label only (no per-row config).
// =============================================================================

import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { applyInsertToField } from '@/lib/editor/insert-at-cursor';
import { cn } from '@/lib/utils';

import type {
  AutomationEditorAction,
  AutomationEditorActionType,
  AutomationVariable,
} from '@/lib/automations/types';

type ChangeKind =
  | { kind: 'body'; body: string; subject?: string | null }
  | { kind: 'config'; config: Record<string, unknown> };

type AutomationActionCardProps = {
  action: AutomationEditorAction;
  isFirst: boolean;
  isLast: boolean;
  variables: AutomationVariable[];
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
  onChange: (change: ChangeKind) => void;
  saving?: boolean;
};

const ACTION_LABEL: Record<AutomationEditorActionType, string> = {
  send_sms_to_lead: 'SMS to lead',
  send_email_to_lead: 'Email to lead',
  send_operator_notification: 'Operator alert',
  wait_for_duration: 'Wait',
  update_lead_field: 'Update lead',
  create_followup_task: 'Follow-up task',
};

const ACTION_TONE: Record<AutomationEditorActionType, string> = {
  send_sms_to_lead: 'bg-good/12 text-good',
  send_email_to_lead: 'bg-info/14 text-info',
  send_operator_notification: 'bg-amber/14 text-amber',
  wait_for_duration: 'bg-ink/8 text-ink-quiet',
  update_lead_field: 'bg-plum/14 text-plum',
  create_followup_task: 'bg-rust/12 text-rust',
};

function AutomationActionCard({
  action,
  isFirst,
  isLast,
  variables,
  onMove,
  onRemove,
  onChange,
  saving,
}: AutomationActionCardProps) {
  const isComm =
    action.actionType === 'send_sms_to_lead' ||
    action.actionType === 'send_email_to_lead';

  return (
    <div
      data-slot="automation-action-card"
      data-action-type={action.actionType}
      className={cn(
        'overflow-hidden rounded-[10px] border border-rule bg-card transition-all',
        saving && 'opacity-70',
      )}
    >
      <div
        data-slot="automation-action-card-header"
        className="grid grid-cols-[26px_auto_1fr_auto_auto_auto] items-center gap-3 border-b border-paper-2 bg-paper px-4.5 py-3.5"
      >
        <div className="flex size-6.5 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-extrabold text-rust-light">
          {action.position}
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
            ACTION_TONE[action.actionType],
          )}
        >
          {ACTION_LABEL[action.actionType]}
        </span>
        <span className="truncate font-sans text-[13px] font-bold text-ink">
          {action.pausesOnHumanActivity ? (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
              Pauses on client reply
            </span>
          ) : null}
        </span>
        <IconBtn label="Move up" disabled={isFirst} onClick={() => onMove('up')}>
          ↑
        </IconBtn>
        <IconBtn label="Move down" disabled={isLast} onClick={() => onMove('down')}>
          ↓
        </IconBtn>
        <IconBtn label="Delete" danger onClick={onRemove}>
          ×
        </IconBtn>
      </div>

      <div className="px-5.5 py-4.5">
        {isComm ? (
          <CommActionBody
            action={action}
            variables={variables}
            onChange={(body, subject) =>
              onChange({ kind: 'body', body, subject })
            }
          />
        ) : action.actionType === 'wait_for_duration' ? (
          <WaitConfig
            config={action.config}
            onChange={(config) => onChange({ kind: 'config', config })}
          />
        ) : action.actionType === 'update_lead_field' ? (
          <UpdateLeadFieldConfig
            config={action.config}
            onChange={(config) => onChange({ kind: 'config', config })}
          />
        ) : action.actionType === 'create_followup_task' ? (
          <FollowupTaskConfig
            config={action.config}
            onChange={(config) => onChange({ kind: 'config', config })}
          />
        ) : (
          <OperatorNotificationConfig config={action.config} />
        )}
      </div>
    </div>
  );
}

function CommActionBody({
  action,
  variables,
  onChange,
}: {
  action: AutomationEditorAction;
  variables: AutomationVariable[];
  onChange: (body: string, subject: string | null) => void;
}) {
  const [body, setBody] = useState(action.body ?? '');
  const [subject, setSubject] = useState(action.subject ?? '');
  const isEmail = action.actionType === 'send_email_to_lead';

  // Re-sync local state when the action's underlying body/subject changes
  // (e.g. after a successful save invalidates the query).
  useEffect(() => {
    setBody(action.body ?? '');
    setSubject(action.subject ?? '');
  }, [action.id, action.body, action.subject]);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const focusedField = useRef<'body' | 'subject'>('body');

  const insertVariable = (code: string) => {
    if (isEmail && focusedField.current === 'subject') {
      applyInsertToField(subjectRef.current, (next) => {
        setSubject(next);
        onChange(body, next);
      }, code);
    } else {
      applyInsertToField(bodyRef.current, (next) => {
        setBody(next);
        onChange(next, isEmail ? subject : null);
      }, code);
    }
  };

  return (
    <div>
      {isEmail ? (
        <Input
          ref={subjectRef}
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            onChange(body, e.target.value);
          }}
          onFocus={() => {
            focusedField.current = 'subject';
          }}
          placeholder="Subject…"
          aria-label="Email subject"
          className="mb-2.5 rounded-md border-rule bg-paper font-sans text-[13px] font-semibold"
        />
      ) : null}
      <Textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          onChange(e.target.value, isEmail ? subject : null);
        }}
        onFocus={() => {
          focusedField.current = 'body';
        }}
        aria-label="Message body"
        rows={5}
        className="block min-h-28 w-full resize-y whitespace-pre-wrap rounded-md border border-rule bg-paper px-4 py-3.5 font-sans text-[14px] leading-[1.55] text-ink"
      />
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
          Insert variable:
        </span>
        {variables.map((v) => (
          <button
            key={v.code}
            type="button"
            onClick={() => insertVariable(`{{${stripBraces(v.code)}}}`)}
            title={v.description}
            className="inline-flex items-center rounded-[4px] bg-rust/12 px-2 py-0.5 font-mono text-[10px] font-bold text-rust transition-colors hover:bg-rust hover:text-paper"
          >
            {v.code}
          </button>
        ))}
      </div>
    </div>
  );
}

function stripBraces(code: string): string {
  return code.replace(/^\{+|\}+$/g, '');
}

function WaitConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const minutes = typeof config.minutes === 'number' ? config.minutes : 60;
  return (
    <label className="flex items-center gap-3">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        Wait
      </span>
      <Input
        type="number"
        min={1}
        value={minutes}
        onChange={(e) => {
          const next = Math.max(1, parseInt(e.target.value, 10) || 1);
          onChange({ ...config, minutes: next });
        }}
        className="w-24 rounded-md border-rule bg-paper text-center font-sans text-[14px]"
      />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        minutes before the next action
      </span>
    </label>
  );
}

function UpdateLeadFieldConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const field = typeof config.field === 'string' ? config.field : 'status';
  const value = typeof config.value === 'string' ? config.value : '';
  const statusOptions = ['new', 'contacted', 'booked', 'completed', 'lost'];
  const urgencyOptions = ['none', 'soon', 'asap'];
  const options = field === 'status' ? statusOptions : urgencyOptions;
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        Set
      </span>
      <select
        value={field}
        onChange={(e) => onChange({ ...config, field: e.target.value, value: '' })}
        className="rounded-md border border-rule bg-paper px-2.5 py-1.5 font-sans text-[13px] font-semibold text-ink outline-none"
      >
        <option value="status">status</option>
        <option value="urgency">urgency</option>
      </select>
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        to
      </span>
      <select
        value={value}
        onChange={(e) => onChange({ ...config, value: e.target.value })}
        className="rounded-md border border-rule bg-paper px-2.5 py-1.5 font-sans text-[13px] font-semibold text-ink outline-none"
      >
        <option value="" disabled>
          pick a value
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function FollowupTaskConfig({
  config,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const hint = typeof config.hint === 'string' ? config.hint : '';
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-ink-quiet">
        Hint shown to the operator (optional)
      </span>
      <Input
        type="text"
        value={hint}
        onChange={(e) => onChange({ ...config, hint: e.target.value })}
        placeholder="e.g. ‘Lead went quiet — text from your own number.’"
        className="w-full rounded-md border-rule bg-paper font-sans text-[13px]"
      />
    </label>
  );
}

function OperatorNotificationConfig({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const variant = typeof config.variant === 'string' ? config.variant : 'new_lead';
  const label =
    variant === 'payment_failed'
      ? 'Notifies operators of a failed Stripe payment.'
      : 'Notifies the operator(s) configured in /settings/notifications.';
  return (
    <p className="font-sans text-[13px] text-ink-soft">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-ink-quiet">
        Variant:
      </span>{' '}
      <span className="font-mono text-[12px] font-bold text-ink">{variant}</span>
      <span className="ml-3 text-ink-quiet">{label}</span>
    </p>
  );
}

function IconBtn({
  children,
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-7 items-center justify-center rounded-md border border-rule bg-card font-mono text-[13px] text-ink-quiet transition-colors',
        !disabled &&
          (danger
            ? 'hover:border-warn hover:bg-warn hover:text-paper'
            : 'hover:border-ink hover:bg-ink hover:text-paper'),
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

export { AutomationActionCard };
export type { AutomationActionCardProps };
