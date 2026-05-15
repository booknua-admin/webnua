'use client';

// =============================================================================
// CopyField — a text field wired with both per-field capability gating and
// AI controls. Used by every section's Fields component.
//
//   - For users WITH `editCopy` (admin, Mark@Voltline): renders an editable
//     input or textarea.
//   - For users WITHOUT `editCopy` (Anna@FreshHome view-only): renders the
//     input inert with the request-change affordance overlaying it on
//     hover — the field is visible but action requires a ticket.
//   - For users WITH `useAI`: an inline `✦ Regen` button cycles the field
//     through the section's hardcoded alternatives. An `↶ Original` button
//     appears only when the value differs from `originalValue`.
//   - For users WITHOUT `useAI`: the AI buttons are hidden entirely.
//
// AI regeneration is a STUB this session — `Regen` cycles through the
// alternatives array. Session 6's form-to-page generation work wires the
// real LLM round-trip; the per-field button surface stays the same.
// =============================================================================

import { useState, type ReactNode } from 'react';

import {
  BuilderField,
  BuilderInput,
  BuilderTextarea,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { useCan } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

export type CopyFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  /** Original value (from defaultData) — drives the "↶ Original" button. */
  originalValue?: string;
  /** Stub alternatives for the AI "Regen" cycle. Omit to hide the button. */
  alternatives?: readonly string[];
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  helper?: ReactNode;
  /** Which capability gates this field. Default: 'editCopy'. */
  capability?: 'editCopy' | 'editSEO';
};

export function CopyField({
  label,
  value,
  onChange,
  originalValue,
  alternatives,
  multiline = false,
  rows,
  placeholder,
  helper,
  capability = 'editCopy',
}: CopyFieldProps) {
  const canUseAI = useCan('useAI');
  const [variantIndex, setVariantIndex] = useState(0);

  const hasAlternatives = !!alternatives && alternatives.length > 0;
  const isChanged = originalValue !== undefined && value !== originalValue;
  const showAIControls = canUseAI && (hasAlternatives || isChanged);

  const handleRegen = () => {
    if (!hasAlternatives) return;
    const next = (variantIndex + 1) % alternatives.length;
    setVariantIndex(next);
    onChange(alternatives[next]);
  };

  const handleRevert = () => {
    if (originalValue === undefined) return;
    setVariantIndex(0);
    onChange(originalValue);
  };

  const hint = showAIControls ? (
    <span className="inline-flex items-center gap-1.5">
      {hasAlternatives ? (
        <AIButton onClick={handleRegen} title="Cycle through AI variants">
          ✦ Regen
        </AIButton>
      ) : null}
      {isChanged ? (
        <AIButton onClick={handleRevert} title="Revert to original">
          ↶ Original
        </AIButton>
      ) : null}
    </span>
  ) : undefined;

  return (
    <BuilderField label={label} hint={hint} helper={helper}>
      <CapabilityGate capability={capability} mode="request">
        {multiline ? (
          <BuilderTextarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows ?? 3}
            placeholder={placeholder}
          />
        ) : (
          <BuilderInput
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        )}
      </CapabilityGate>
    </BuilderField>
  );
}

function AIButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-pill border border-rust/40 bg-rust-soft px-2 py-0.5',
        'font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-rust',
        'transition-colors hover:bg-rust hover:text-paper',
      )}
    >
      {children}
    </button>
  );
}
