'use client';

import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

// =============================================================================
// RequestChangeAffordance — hover-overlay shown by <CapabilityGate mode="request">
// when a user lacks the capability for a given control. Renders the underlying
// control as visually-present-but-inert; hover surfaces a click target that
// fires the request-change callback.
//
// In Session 1a the callback is a stub. Real ticket-creation wires up in a
// later session (per design doc §1.3 — request-change tickets carry
// { websiteId, pageId, sectionId, fieldKey? } context).
// =============================================================================

export type RequestChangeAffordanceProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

export function RequestChangeAffordance({
  label,
  onClick,
  children,
  className,
}: RequestChangeAffordanceProps) {
  return (
    <span
      data-slot="request-change-affordance"
      className={cn('group relative inline-flex isolate', className)}
    >
      <span aria-hidden className="pointer-events-none opacity-55">
        {children}
      </span>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          'rounded-md border border-rust/40 bg-rust-soft/95',
          'font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rust',
          'opacity-0 transition-opacity duration-150',
          'group-hover:opacity-100 focus-visible:opacity-100',
          'cursor-pointer hover:bg-rust-soft',
        )}
      >
        {label} →
      </button>
    </span>
  );
}
