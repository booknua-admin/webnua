'use client';

// =============================================================================
// AutomationAddActionMenu — append-a-new-action button + type picker dialog.
//
// Phase 8 · Session 3. Replaces the placeholder `AutomationAddStep` (which
// just rendered an inert dashed-border CTA). Picks one of the six closed
// action_type enum values; the picked type fires onPick which appends a
// fresh action with default config.
// =============================================================================

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AutomationEditorActionType } from '@/lib/automations/types';
import { cn } from '@/lib/utils';

const TYPE_OPTIONS: ReadonlyArray<{
  type: AutomationEditorActionType;
  label: string;
  description: string;
  tone: string;
}> = [
  {
    type: 'send_sms_to_lead',
    label: 'SMS to lead',
    description: 'Send the lead a templated SMS. Pauses if the lead replies.',
    tone: 'bg-good/12 text-good',
  },
  {
    type: 'send_email_to_lead',
    label: 'Email to lead',
    description: 'Send the lead a templated email. Pauses if the lead replies.',
    tone: 'bg-info/14 text-info',
  },
  {
    type: 'wait_for_duration',
    label: 'Wait',
    description: 'Pause for N minutes before the next action runs.',
    tone: 'bg-ink/8 text-ink-quiet',
  },
  {
    type: 'send_operator_notification',
    label: 'Operator alert',
    description: 'Email the operator(s) configured in /settings/notifications.',
    tone: 'bg-amber/14 text-amber',
  },
  {
    type: 'update_lead_field',
    label: 'Update lead',
    description: 'Change the lead’s status or urgency in place.',
    tone: 'bg-plum/14 text-plum',
  },
  {
    type: 'create_followup_task',
    label: 'Follow-up task',
    description: 'Flag the lead for operator follow-up (no message sent).',
    tone: 'bg-rust/12 text-rust',
  },
];

type AutomationAddActionMenuProps = {
  onPick: (type: AutomationEditorActionType) => void;
  disabled?: boolean;
  label?: string;
};

function AutomationAddActionMenu({
  onPick,
  disabled,
  label = '+ Add another action',
}: AutomationAddActionMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn(
          'block w-full rounded-md border-2 border-dashed border-rule bg-paper/50 px-5 py-4 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-ink-quiet transition-colors hover:border-rust hover:text-rust',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>Pick an action type</DialogTitle>
            <DialogDescription>
              The new action appends at the end of the sequence. Edit its body
              or settings inline.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  onPick(opt.type);
                  setOpen(false);
                }}
                className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-md border border-rule bg-card px-4 py-3 text-left transition-colors hover:border-rust hover:bg-rust-soft/30"
              >
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em]',
                    opt.tone,
                  )}
                >
                  {opt.label}
                </span>
                <span className="font-sans text-[13px] leading-[1.45] text-ink-soft">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AutomationAddActionMenu };
