'use client';

// =============================================================================
// SectionFieldsPanel — the third column of the editor, only visible when a
// section is selected. Mounts the section type's `Fields` component (from
// the registry) with live-updating local state, so edits propagate to the
// preview pane immediately.
//
// Per-field capability gating happens INSIDE the Fields component (every
// section's Fields uses CopyField/MediaField, both of which wrap inputs
// in CapabilityGate). The panel itself just provides the chrome — header
// with the section type label + close, scrollable body for the fields.
// =============================================================================

import type { Section } from '@/lib/website/types';
import { getSectionDefinition } from '@/lib/website/sections';

export type SectionFieldsPanelProps = {
  section: Section;
  /** Called with the new section data on every Fields edit. */
  onChange: (nextData: Record<string, unknown>) => void;
  /** Closes the panel (clears selection). */
  onClose: () => void;
  /** Suppresses the close button — used in singleton mode where the section
   *  is the only one and there's nothing to deselect to. */
  hideClose?: boolean;
};

export function SectionFieldsPanel({
  section,
  onChange,
  onClose,
  hideClose = false,
}: SectionFieldsPanelProps) {
  const def = getSectionDefinition(section.type);
  if (!def) {
    return (
      <aside className="border-l border-rule bg-paper-2 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-warn">
          Unknown section type: {section.type}
        </p>
      </aside>
    );
  }

  const Fields = def.Fields;

  return (
    <aside
      data-slot="section-fields-panel"
      className="flex h-full min-h-0 flex-col border-l border-rule bg-paper"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <p className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-rust">
          {def.label}
        </p>
        {hideClose ? null : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close fields panel"
            className="shrink-0 rounded font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-quiet transition-colors hover:text-ink"
          >
            Close ×
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 [&_[data-slot=builder-form-section]]:mb-3.5 [&_[data-slot=builder-form-section]]:border-b [&_[data-slot=builder-form-section]]:border-paper-2 [&_[data-slot=builder-form-section]]:pb-3.5 [&_[data-slot=builder-form-section]:last-child]:mb-0 [&_[data-slot=builder-form-section]:last-child]:border-b-0 [&_[data-slot=builder-form-section]:last-child]:pb-0">
        {/* `as never` cast at the registry boundary — the Fields component
            is typed against its specific data shape; the registry stores
            them as unknown. defaultData() guarantees the shape on creation. */}
        <Fields data={section.data as never} onChange={onChange as never} />
      </div>

      {!def.implemented ? (
        <div className="border-t border-rule bg-paper-2 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
            Placeholder · real fields land in a future session.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
