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
//   - For users WITH `useAI`: an inline `✦ Regen` button requests one model-
//     drafted alternate rewrite. The result is shown as an accept/reject
//     preview rather than silently replacing the field. When the backend is
//     unavailable, the control falls back to the local alternatives array.
//     An `↶ Original` button appears only when the value differs from
//     `originalValue`.
//   - For users WITHOUT `useAI`: the AI buttons are hidden entirely.
//
// The builder keeps the old alternatives array as a graceful local fallback,
// but the happy path is now a real model-backed rewrite via /api/rewrite-field.
// =============================================================================

import { useState, type ReactNode } from 'react';

import {
  BuilderField,
  BuilderInput,
  BuilderTextarea,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { AppError } from '@/lib/errors';
import { rewriteField } from '@/lib/website/rewrite-field';
import { useCan } from '@/lib/auth/user-stub';
import { cn } from '@/lib/utils';

import { useSectionFieldContext } from './field-context';

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
  const { sectionLabel, aiContext } = useSectionFieldContext();
  const [variantIndex, setVariantIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasAlternatives = !!alternatives && alternatives.length > 0;
  const isChanged = originalValue !== undefined && value !== originalValue;
  const hasValue = value.trim().length > 0;
  const showAIControls = canUseAI && (hasValue || hasAlternatives || isChanged);

  const fallbackToLocalAlternative = () => {
    if (!hasAlternatives) return false;
    const next = (variantIndex + 1) % alternatives.length;
    setVariantIndex(next);
    setPreview(alternatives[next]);
    return true;
  };

  const handleRegen = async () => {
    setError(null);
    setBusy(true);
    try {
      const fieldText = typeof label === 'string' ? label : 'Website copy';
      const rewritten = await rewriteField({
        fieldName: sectionLabel ? `${sectionLabel} · ${fieldText}` : fieldText,
        currentValue: value,
        context: {
          sectionLabel: sectionLabel ?? undefined,
          industry: aiContext?.industry,
          audienceLine: aiContext?.audienceLine,
        },
      });
      setPreview(rewritten);
    } catch (err) {
      const usedFallback = fallbackToLocalAlternative();
      if (!usedFallback) {
        const msg =
          err instanceof AppError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Rewrite failed.';
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRevert = () => {
    if (originalValue === undefined) return;
    setVariantIndex(0);
    onChange(originalValue);
  };

  const acceptPreview = () => {
    if (!preview) return;
    onChange(preview);
    setPreview(null);
  };

  const rejectPreview = () => {
    setPreview(null);
  };

  const hint = showAIControls ? (
    <span className="inline-flex items-center gap-1.5">
      {hasAlternatives ? (
        <AIButton onClick={() => void handleRegen()} title="Draft one alternate version">
          {busy ? 'Drafting…' : '✦ Regen'}
        </AIButton>
      ) : busy ? (
        <AIButton onClick={() => {}} title="Drafting…" disabled>
          Drafting…
        </AIButton>
      ) : (
        <AIButton onClick={() => void handleRegen()} title="Draft one alternate version">
          ✦ Regen
        </AIButton>
      )}
      {isChanged ? (
        <AIButton onClick={handleRevert} title="Revert to original">
          ↶ Original
        </AIButton>
      ) : null}
    </span>
  ) : undefined;

  return (
    <BuilderField label={label} hint={hint} helper={helper}>
      <CapabilityGate
        capability={capability}
        mode="request"
        requestContext={{
          sectionLabel: sectionLabel ?? undefined,
          fieldLabel: typeof label === 'string' ? label : undefined,
          currentValue: value || undefined,
        }}
      >
        {multiline ? (
          <BuilderTextarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows ?? 3}
            placeholder={placeholder}
            disabled={busy || preview != null}
          />
        ) : (
          <BuilderInput
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={busy || preview != null}
          />
        )}
      </CapabilityGate>
      {preview ? (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-rust/40 bg-rust-soft/60 px-3 py-2.5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            ✦ AI rewrite preview
          </p>
          <p className="whitespace-pre-wrap text-[13px] text-ink">{preview}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={acceptPreview}
              className="rounded-md bg-rust px-3 py-1.5 text-[12px] font-bold text-paper transition-colors hover:bg-rust-deep"
            >
              Use this →
            </button>
            <button
              type="button"
              onClick={rejectPreview}
              className="rounded-md border border-rule bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-mid transition-colors hover:border-rust/60 hover:text-ink"
            >
              Keep mine
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-2 rounded-md border border-warn/40 border-l-4 border-l-warn bg-warn/[0.06] px-3 py-2 text-[12px] text-warn">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
            Rewrite error
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words">{error}</p>
        </div>
      ) : null}
    </BuilderField>
  );
}

function AIButton({
  children,
  onClick,
  title,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'rounded-pill border border-rust/40 bg-rust-soft px-2 py-0.5',
        'font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-rust',
        'transition-colors hover:bg-rust hover:text-paper disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}
