'use client';

// =============================================================================
// VariantField — a left/right cycle picker for a section's structural choices
// (layout / image-side / …), wired with per-field capability gating
// (Phase 6 · section-library uplift).
//
// Renders as `‹  Current label  ›` — the universal control for cycling any
// small enum on any section. Sibling to CopyField / MediaField / ThemeField;
// gates structural choices on `editLayout` by default.
// =============================================================================

import type { ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import type { Capability } from '@/lib/auth/capabilities';

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
  const index = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  const current = options[index] ?? options[0];

  const cycle = (delta: number) => {
    if (options.length === 0) return;
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].id);
  };

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
        <div className="flex items-stretch overflow-hidden rounded-md border border-rule bg-card">
          <CycleArrow direction="prev" onClick={() => cycle(-1)} />
          <span className="flex-1 select-none border-x border-rule px-3 py-2 text-center text-[13px] font-semibold text-ink">
            {current?.label ?? '—'}
          </span>
          <CycleArrow direction="next" onClick={() => cycle(1)} />
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}

function CycleArrow({
  direction,
  onClick,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'prev' ? 'Previous' : 'Next'}
      className="px-3 text-[15px] font-bold text-ink-quiet transition-colors hover:bg-rust-soft hover:text-rust"
    >
      {direction === 'prev' ? '‹' : '›'}
    </button>
  );
}
