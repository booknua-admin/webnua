'use client';

// =============================================================================
// SectionHoverToolbar — the floating per-section controls in the preview
// (Phase 6 · rail removal). Replaces the old left-rail row: move up/down,
// duplicate, show/hide, delete. Appears on hover (or stays while the section
// is selected). Frees the editor to show the page near-full-width.
// =============================================================================

import { CapabilityGate } from '@/components/shared/CapabilityGate';

export type SectionHoverToolbarProps = {
  enabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Pinned visible (the section is selected) vs hover-only. */
  visible: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleEnabled: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

export function SectionHoverToolbar({
  enabled,
  canMoveUp,
  canMoveDown,
  visible,
  onMoveUp,
  onMoveDown,
  onToggleEnabled,
  onDuplicate,
  onRemove,
}: SectionHoverToolbarProps) {
  // Each handler stops propagation so a toolbar click never also selects /
  // deselects the section.
  const guard = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={[
        'absolute right-3 top-3 z-20 flex items-center gap-0.5 rounded-md',
        'border border-white/10 bg-ink/95 px-1 py-1 shadow-card transition-opacity',
        visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      ].join(' ')}
    >
      <CapabilityGate capability="editLayout" mode="hide">
        <div className="flex items-center gap-0.5">
          <ToolBtn label="Move up" disabled={!canMoveUp} onClick={guard(onMoveUp)}>
            ↑
          </ToolBtn>
          <ToolBtn
            label="Move down"
            disabled={!canMoveDown}
            onClick={guard(onMoveDown)}
          >
            ↓
          </ToolBtn>
          <ToolBtn
            label={enabled ? 'Hide section' : 'Show section'}
            onClick={guard(onToggleEnabled)}
          >
            {enabled ? '◉' : '◌'}
          </ToolBtn>
        </div>
      </CapabilityGate>
      <CapabilityGate capability="editSections" mode="hide">
        <div className="flex items-center gap-0.5">
          <ToolBtn label="Duplicate section" onClick={guard(onDuplicate)}>
            ⧉
          </ToolBtn>
          <ToolBtn label="Delete section" danger onClick={guard(onRemove)}>
            ✕
          </ToolBtn>
        </div>
      </CapabilityGate>
    </div>
  );
}

function ToolBtn({
  children,
  label,
  disabled = false,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'flex h-6 w-6 items-center justify-center rounded text-[13px] leading-none transition-colors',
        'text-paper/75 disabled:opacity-30',
        danger
          ? 'hover:bg-warn hover:text-paper'
          : 'hover:bg-paper/15 hover:text-paper',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
