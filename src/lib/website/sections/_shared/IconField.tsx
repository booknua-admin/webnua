'use client';

// =============================================================================
// IconField — a professional icon picker for a section item's icon (Phase 6 ·
// section-library uplift). Sibling to CopyField / MediaField / VariantField.
//
// Stores an icon *id* from the curated `section-icons` library (lucide-backed).
// The control shows the current icon in a swatch; clicking expands an inline
// searchable grid. Gated on `editCopy` by default.
// =============================================================================

import { useState, type ReactNode } from 'react';

import { BuilderField } from '@/components/shared/builder/BuilderField';
import { CapabilityGate } from '@/components/shared/CapabilityGate';
import type { Capability } from '@/lib/auth/capabilities';
import { getSectionIcon, searchSectionIcons } from '@/lib/website/section-icons';
import { cn } from '@/lib/utils';

import { useSectionFieldContext } from './field-context';

export type IconFieldProps = {
  label?: ReactNode;
  value: string;
  onChange: (next: string) => void;
  helper?: ReactNode;
  /** Which capability gates this field. Default: 'editCopy'. */
  capability?: Capability;
};

export function IconField({
  label = 'Icon',
  value,
  onChange,
  helper,
  capability = 'editCopy',
}: IconFieldProps) {
  const { sectionLabel } = useSectionFieldContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const current = getSectionIcon(value);
  const results = searchSectionIcons(query);
  const CurrentIcon = current?.Icon;

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
        <div className="rounded-md border border-rule bg-card">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-paper-2 text-ink">
              {CurrentIcon ? (
                <CurrentIcon size={18} strokeWidth={1.9} aria-hidden />
              ) : (
                <span className="font-mono text-[10px] text-ink-quiet">—</span>
              )}
            </span>
            <span className="flex-1 text-[13px] font-semibold text-ink">
              {current?.label ?? 'Choose an icon'}
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rust">
              {open ? 'Close' : 'Change'}
            </span>
          </button>
          {open ? (
            <div className="border-t border-rule p-2.5">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search icons…"
                className="mb-2 w-full rounded border border-rule bg-paper px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-rust"
              />
              <div className="max-h-[208px] overflow-y-auto">
                {results.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[12px] text-ink-quiet">
                    No icons match “{query}”.
                  </p>
                ) : (
                  <div className="grid grid-cols-6 gap-1.5">
                    {results.map((def) => {
                      const Icon = def.Icon;
                      const active = def.id === value;
                      return (
                        <button
                          key={def.id}
                          type="button"
                          title={`${def.label} · ${def.group}`}
                          aria-label={def.label}
                          aria-pressed={active}
                          onClick={() => {
                            onChange(def.id);
                            setOpen(false);
                            setQuery('');
                          }}
                          className={cn(
                            'flex aspect-square items-center justify-center rounded-md border transition-colors',
                            active
                              ? 'border-rust bg-rust-soft text-rust'
                              : 'border-rule bg-paper text-ink-mid hover:border-rust/60 hover:text-ink',
                          )}
                        >
                          <Icon size={18} strokeWidth={1.9} aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </CapabilityGate>
    </BuilderField>
  );
}
