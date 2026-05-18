'use client';

// =============================================================================
// MediaField — image URL field with `editMedia` gating. Sibling to CopyField.
//
// For Session 4 this is a URL input — real upload + crop UI lands when
// asset management ships (backend pass). The per-field capability gate +
// the visual chrome are what matters here.
// =============================================================================

import { type ReactNode } from 'react';

import {
  BuilderField,
  BuilderInput,
} from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

import { useSectionFieldContext } from './field-context';

export type MediaFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  helper?: ReactNode;
};

export function MediaField({
  label,
  value,
  onChange,
  placeholder = 'https://…',
  helper,
}: MediaFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  return (
    <BuilderField label={label} helper={helper}>
      <CapabilityGate
        capability="editMedia"
        mode="request"
        requestContext={{
          sectionLabel: sectionLabel ?? undefined,
          fieldLabel: typeof label === 'string' ? label : undefined,
          currentValue: value || undefined,
        }}
      >
        <BuilderInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="url"
        />
      </CapabilityGate>
    </BuilderField>
  );
}
