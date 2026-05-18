'use client';

// =============================================================================
// Theme controls (Phase 6 · element-inspector model):
//
//   ThemePresetField — a row of preset theme circles; picking one applies a
//     whole SectionTheme. Lives in a section's section-level settings as a
//     quick start.
//   ColorField — a single labelled colour picker. Lives under whichever
//     element owns that colour (background → section level, heading colour
//     → headline element, text colour → sub-headline element). Splitting the
//     colours across element selections is what removes the old "circles and
//     swatches both edit colour" redundancy.
//
// Both gate on `editTheme`.
// =============================================================================

import type { ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import {
  matchPresetId,
  THEME_PRESETS,
  type SectionTheme,
} from '@/lib/website/section-theme';
import { cn } from '@/lib/utils';

import { useSectionFieldContext } from './field-context';

// -- ThemePresetField -------------------------------------------------------

export type ThemePresetFieldProps = {
  label?: ReactNode;
  value: SectionTheme;
  onChange: (next: SectionTheme) => void;
};

export function ThemePresetField({
  label = 'Theme preset',
  value,
  onChange,
}: ThemePresetFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  const activePresetId = matchPresetId(value);

  return (
    <BuilderField
      label={label}
      helper={<>A quick start — fine-tune each colour per element.</>}
    >
      <CapabilityGate
        capability="editTheme"
        mode="request"
        requestContext={{ sectionLabel: sectionLabel ?? undefined }}
      >
        <div className="flex flex-wrap gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.label}
              aria-label={`${preset.label} theme`}
              aria-pressed={activePresetId === preset.id}
              onClick={() => onChange({ ...preset.theme })}
              className={cn(
                'relative h-9 w-9 rounded-full border-2 transition-transform hover:scale-105',
                activePresetId === preset.id ? 'border-rust' : 'border-rule',
              )}
              style={{ backgroundColor: preset.theme.background }}
            >
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: preset.theme.heading }}
              />
            </button>
          ))}
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}

// -- ColorField -------------------------------------------------------------

export type ColorFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (next: string) => void;
  helper?: ReactNode;
};

export function ColorField({ label, value, onChange, helper }: ColorFieldProps) {
  const { sectionLabel } = useSectionFieldContext();

  return (
    <BuilderField label={label} helper={helper}>
      <CapabilityGate
        capability="editTheme"
        mode="request"
        requestContext={{
          sectionLabel: sectionLabel ?? undefined,
          fieldLabel: typeof label === 'string' ? label : undefined,
        }}
      >
        <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-md border border-rule bg-card px-2.5 py-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border border-rule bg-transparent p-0"
            aria-label={typeof label === 'string' ? label : 'Colour'}
          />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
            {value}
          </span>
        </label>
      </CapabilityGate>
    </BuilderField>
  );
}
