'use client';

// =============================================================================
// Theme controls (Phase 6 · element-inspector model + brand defaults):
//
//   ThemePresetField — preset theme circles; picking one applies a whole
//     SectionTheme. A section-level quick start.
//   ColorField — a single labelled colour picker for an element's colour.
//     A colour can be inherited from the brand default (no override) or set
//     locally. Changing it offers "apply to all" — promote to a brand
//     default so every section follows.
//
// Both gate on `editTheme`.
// =============================================================================

import { useState, type ReactNode } from 'react';

import { ApplyToAllModal } from '@/components/shared/website/ApplyToAllModal';
import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { isApplyToAllDismissed } from '@/lib/website/brand-style-stub';
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
  /** The effective colour shown in the swatch (resolved if inherited). */
  value: string;
  /** Sets a per-section override. */
  onChange: (next: string) => void;
  helper?: ReactNode;
  /** True when the section has no override — the colour is inherited from
   *  the brand default. */
  inherited?: boolean;
  /** Label shown when `inherited` is true. Default "Brand default". */
  inheritedLabel?: string;
  /** Clears the override (back to inherited). Shown only when overridden. */
  onReset?: () => void;
  /** Enables the "apply to all" modal after a change — promote the colour
   *  to a brand default. `scopeLabel` is the plural element name. */
  applyToAll?: { scopeLabel: string; onApply: (color: string) => void };
};

export function ColorField({
  label,
  value,
  onChange,
  helper,
  inherited = false,
  inheritedLabel = 'Brand default',
  onReset,
  applyToAll,
}: ColorFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  const [modalOpen, setModalOpen] = useState(false);

  const handleChange = (next: string) => {
    onChange(next);
    if (applyToAll && !isApplyToAllDismissed()) setModalOpen(true);
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-fit cursor-pointer items-center gap-2.5 rounded-md border border-rule bg-card px-2.5 py-2">
            <input
              type="color"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border border-rule bg-transparent p-0"
              aria-label={typeof label === 'string' ? label : 'Colour'}
            />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
              {value}
            </span>
          </label>
          {inherited ? (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-quiet">
              {inheritedLabel}
            </span>
          ) : onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust transition-colors hover:text-rust-deep"
            >
              ↺ Reset
            </button>
          ) : null}
        </div>
      </CapabilityGate>
      {applyToAll ? (
        <ApplyToAllModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          scopeLabel={applyToAll.scopeLabel}
          onApplyEverywhere={() => applyToAll.onApply(value)}
        />
      ) : null}
    </BuilderField>
  );
}
