'use client';

// =============================================================================
// VariantField — a labelled enum picker for a section's structural choices
// (layout / surface / image-side / …), wired with per-field capability
// gating (Phase 6 · section-library uplift).
//
// Sibling to CopyField / MediaField: where those gate text/media on
// `editCopy` / `editMedia`, VariantField gates structural choices on
// `editLayout` by default. A view-only user sees the request-change
// affordance over the inert picker, exactly as with CopyField.
// =============================================================================

import type { ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import type { Capability } from '@/lib/auth/capabilities';
import { cn } from '@/lib/utils';

import { useSectionFieldContext } from './field-context';

export type VariantOption<T extends string> = {
  id: T;
  label: string;
};

export type VariantFieldProps<T extends string> = {
  label: ReactNode;
  value: T;
  options: readonly VariantOption<T>[];
  onChange: (next: T) => void;
  helper?: ReactNode;
  /** Which capability gates this field. Default: 'editLayout'. */
  capability?: Capability;
};

export function VariantField<T extends string>({
  label,
  value,
  options,
  onChange,
  helper,
  capability = 'editLayout',
}: VariantFieldProps<T>) {
  const { sectionLabel } = useSectionFieldContext();

  return (
    <BuilderField label={label} helper={helper}>
      <CapabilityGate
        capability={capability}
        mode="request"
        requestContext={{
          sectionLabel: sectionLabel ?? undefined,
          fieldLabel: typeof label === 'string' ? label : undefined,
        }}
      >
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(opt.id)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  active
                    ? 'border-rust bg-rust-soft text-rust'
                    : 'border-rule bg-card text-ink-mid hover:border-rust/50 hover:text-ink',
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}
