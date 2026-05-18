'use client';

// =============================================================================
// ToggleField — a labelled boolean switch for a section's on/off settings
// (Phase 6 · section-library uplift). Sibling to CopyField / MediaField /
// VariantField / RangeField / ColorField. Gated on `editLayout` by default.
// =============================================================================

import type { ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Switch } from '@/components/ui/switch';
import type { Capability } from '@/lib/auth/capabilities';

import { useSectionFieldContext } from './field-context';

export type ToggleFieldProps = {
  label: ReactNode;
  value: boolean;
  onChange: (next: boolean) => void;
  helper?: ReactNode;
  /** Which capability gates this field. Default: 'editLayout'. */
  capability?: Capability;
};

export function ToggleField({
  label,
  value,
  onChange,
  helper,
  capability = 'editLayout',
}: ToggleFieldProps) {
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
        <Switch checked={value} onCheckedChange={onChange} />
      </CapabilityGate>
    </BuilderField>
  );
}
