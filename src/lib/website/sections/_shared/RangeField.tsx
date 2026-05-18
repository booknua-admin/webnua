'use client';

// =============================================================================
// RangeField — a labelled slider for a section's numeric settings (overlay
// opacity, etc.), with per-field capability gating (Phase 6 · section-library
// uplift). Sibling to CopyField / MediaField / VariantField / ThemeField.
// =============================================================================

import type { ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import type { Capability } from '@/lib/auth/capabilities';

import { useSectionFieldContext } from './field-context';

export type RangeFieldProps = {
  label: ReactNode;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Appended to the value readout, e.g. '%'. */
  suffix?: string;
  helper?: ReactNode;
  /** Which capability gates this field. Default: 'editLayout'. */
  capability?: Capability;
};

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
  helper,
  capability = 'editLayout',
}: RangeFieldProps) {
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
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-rust"
          />
          <span className="w-12 shrink-0 text-right font-mono text-[11px] font-semibold text-ink">
            {value}
            {suffix}
          </span>
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}
