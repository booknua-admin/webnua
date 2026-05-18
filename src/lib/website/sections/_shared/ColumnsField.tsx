'use client';

// =============================================================================
// ColumnsField — an icon-based column-count picker for grid sections (features,
// services, gallery, reviews). Renders 2–5 as little column-glyph buttons so
// the choice is visual, not a number. Sibling to VariantField / RangeField;
// gates on `editLayout` by default (Phase 6 · section-library uplift).
// =============================================================================

import type { ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import type { Capability } from '@/lib/auth/capabilities';
import { cn } from '@/lib/utils';

import { useSectionFieldContext } from './field-context';

export type ColumnsFieldProps = {
  label?: ReactNode;
  value: number;
  onChange: (next: number) => void;
  /** Smallest selectable count. Default 2. */
  min?: number;
  /** Largest selectable count. Default 5. */
  max?: number;
  helper?: ReactNode;
  /** Which capability gates this field. Default: 'editLayout'. */
  capability?: Capability;
};

export function ColumnsField({
  label = 'Columns',
  value,
  onChange,
  min = 2,
  max = 5,
  helper,
  capability = 'editLayout',
}: ColumnsFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  const counts: number[] = [];
  for (let n = min; n <= max; n += 1) counts.push(n);

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
        <div className="flex flex-wrap gap-2">
          {counts.map((n) => {
            const active = value === n;
            return (
              <button
                key={n}
                type="button"
                aria-label={`${n} columns`}
                aria-pressed={active}
                onClick={() => onChange(n)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border px-2.5 py-2 transition-colors',
                  active
                    ? 'border-rust bg-rust-soft'
                    : 'border-rule bg-card hover:border-rust/60',
                )}
              >
                <span aria-hidden className="flex h-4 items-stretch gap-[2px]">
                  {Array.from({ length: n }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'w-1 rounded-[1px]',
                        active ? 'bg-rust' : 'bg-ink-quiet',
                      )}
                    />
                  ))}
                </span>
                <span
                  className={cn(
                    'font-mono text-[10px] font-bold',
                    active ? 'text-rust' : 'text-ink-quiet',
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}
