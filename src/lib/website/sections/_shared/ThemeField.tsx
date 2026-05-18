'use client';

// =============================================================================
// ThemeField — the per-section colour-theme picker (Phase 6 · section-library
// uplift). A row of preset theme circles + a colour picker per editable
// colour. The universal "what colour is this section" control, used by every
// uplifted section. Gated on `editTheme`.
//
// Picking a circle applies a preset; editing a colour picker customises the
// section's theme (it then matches no preset — no circle shows active).
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

export type ThemeFieldProps = {
  label?: ReactNode;
  value: SectionTheme;
  onChange: (next: SectionTheme) => void;
};

const COLOR_KEYS: { key: keyof SectionTheme; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'heading', label: 'Heading' },
  { key: 'body', label: 'Body' },
];

export function ThemeField({
  label = 'Colour theme',
  value,
  onChange,
}: ThemeFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  const activePresetId = matchPresetId(value);

  return (
    <BuilderField label={label}>
      <CapabilityGate
        capability="editTheme"
        mode="request"
        requestContext={{
          sectionLabel: sectionLabel ?? undefined,
          fieldLabel: typeof label === 'string' ? label : undefined,
        }}
      >
        <div className="space-y-3">
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
                  activePresetId === preset.id
                    ? 'border-rust'
                    : 'border-rule',
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
          <div className="flex flex-wrap gap-2">
            {COLOR_KEYS.map(({ key, label: colorLabel }) => (
              <ColorSwatch
                key={key}
                label={colorLabel}
                value={value[key]}
                onChange={(v) => onChange({ ...value, [key]: v })}
              />
            ))}
          </div>
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-rule bg-card px-2 py-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 cursor-pointer rounded border border-rule bg-transparent p-0"
        aria-label={`${label} colour`}
      />
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
        {label}
      </span>
    </label>
  );
}
