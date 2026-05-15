'use client';

// =============================================================================
// SectionRailRow — single row in the section list rail. Drag handle +
// type label + preview snippet + enable toggle + select-to-edit affordance.
//
// Capability-gated controls:
//   - Drag handle → editLayout
//   - Enable toggle → editLayout
//   - Click-to-edit affordance → editCopy / editMedia (per the section's
//     capabilityHints; for Session 3 the gate is on editLayout for the
//     row click, since editing fields is Session 4)
//
// View-only users (Anna): see the row, can't toggle, can't drag, can't
// click to edit. The row still shows them what's on the page.
// =============================================================================

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getSectionDefinition } from '@/lib/website/sections';
import type { Section } from '@/lib/website/types';

export type SectionRailRowProps = {
  section: Section;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  /** True when this row is the only section in a website-level singleton
   *  rail (header / footer). Suppresses drag handle, enable switch, and
   *  the numbered index — singletons are always-on and unreorderable. */
  singleton?: boolean;
};

export function SectionRailRow({
  section,
  index,
  selected,
  onSelect,
  onToggleEnabled,
  singleton = false,
}: SectionRailRowProps) {
  const def = getSectionDefinition(section.type);
  if (!def) return null;

  return (
    <div
      data-slot="section-rail-row"
      className={cn(
        'group rounded-lg border bg-card px-3 py-2.5 transition-colors',
        selected
          ? 'border-rust bg-rust-soft/40'
          : 'border-rule hover:border-ink/20',
        !section.enabled && !singleton && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2.5">
        {singleton ? null : (
          <CapabilityGate capability="editLayout" mode="disable">
            <button
              type="button"
              aria-label="Drag to reorder"
              className="mt-0.5 cursor-grab font-mono text-[14px] text-ink-quiet hover:text-ink"
              tabIndex={-1}
            >
              ⋮⋮
            </button>
          </CapabilityGate>
        )}
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 text-left"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust">
            {singleton ? def.label : `${def.label} · ${String(index + 1).padStart(2, '0')}`}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-ink">
            {summarizeSection(section, def.description)}
          </p>
          {!def.implemented ? (
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-quiet">
              Placeholder · editor lands in Session 4
            </p>
          ) : null}
        </button>
        {singleton ? null : (
          <CapabilityGate capability="editLayout" mode="hide">
            <Switch
              checked={section.enabled}
              onCheckedChange={onToggleEnabled}
              aria-label={`Toggle ${def.label}`}
              className="mt-0.5"
            />
          </CapabilityGate>
        )}
      </div>
    </div>
  );
}

function summarizeSection(section: Section, fallback: string): string {
  // Best-effort one-line summary of the section. Each section type
  // exposes its primary identifier under a different key; we look up
  // a few common keys without forcing a typed view here.
  const data = section.data as Record<string, unknown>;
  const candidate =
    data.headline ?? data.title ?? data.priceLabel ?? data.tag ?? data.label;
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return truncate(candidate, 64);
  }
  return fallback;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}
