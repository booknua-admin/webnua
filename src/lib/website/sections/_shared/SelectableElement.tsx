'use client';

// =============================================================================
// SelectableElement — wraps a region of a section Preview so it can be
// clicked to select it in the editor (Phase 6 · element-inspector model).
//
// When `onSelect` is omitted the wrapper is inert — a Preview rendered
// outside the editor (or a non-selected section) renders plainly. When it is
// provided, the region is clickable (stopping propagation so the click does
// not also select the whole section) and shows a selection / hover outline.
//
// `outline` is used rather than `ring`/`border` so selection never shifts
// layout.
// =============================================================================

import type { ReactNode } from 'react';

export type SelectableElementProps = {
  /** Element id, e.g. 'headline'. Passed back through onSelect. */
  id: string;
  selected?: boolean;
  onSelect?: (id: string) => void;
  /** `inline-block` for elements inside a flex/inline row (e.g. CTA buttons). */
  display?: 'block' | 'inline-block';
  className?: string;
  children: ReactNode;
};

export function SelectableElement({
  id,
  selected = false,
  onSelect,
  display = 'block',
  className,
  children,
}: SelectableElementProps) {
  if (!onSelect) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div
      data-element={id}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onKeyDown={(e) => {
        // Only activate when the wrapper itself is focused — never swallow
        // keys (notably Space) typed into a nested input / textarea / select.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelect(id);
        }
      }}
      className={[
        display === 'inline-block' ? 'inline-block' : 'block',
        'cursor-pointer rounded-[3px] outline-2 outline-offset-2',
        selected
          ? 'outline outline-rust'
          : 'outline-dashed outline-transparent hover:outline-rust/55',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
