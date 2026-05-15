'use client';

// =============================================================================
// AutosaveIndicator — the mono `● AUTOSAVED 8s ago` pill in EditorToolbar.
// Four visual states keyed off the useAutosave hook result:
//
//   idle    → static good dot, "Autosaved" (no edits since mount)
//   pending → rust pulse dot, "Editing…" (in the 500ms debounce window)
//   saving  → rust pulse dot, "Saving…"  (briefly while writing)
//   synced  → static good dot, "Saved Ns ago"
//   failed  → static warn dot, "Save failed — retry" (button)
//
// The "Ns ago" text re-ticks via an internal 5s interval so it stays current
// even when no further edits trigger a parent re-render.
// =============================================================================

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import type { AutosaveStatus } from '@/lib/website/use-autosave';

export type AutosaveIndicatorProps = {
  status: AutosaveStatus;
  lastSavedAt: number | null;
  onRetry: () => void;
  className?: string;
};

export function AutosaveIndicator({
  status,
  lastSavedAt,
  onRetry,
  className,
}: AutosaveIndicatorProps) {
  // Re-tick every 5s so the "Saved Ns ago" copy stays current when the editor
  // is idle. Cheap — only rerenders this component, not the editor.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const baseClass =
    'hidden font-mono text-[10px] font-bold uppercase tracking-[0.14em] md:inline-flex md:items-center md:gap-1.5';

  if (status === 'failed') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className={cn(baseClass, 'text-warn hover:text-rust', className)}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-warn" />
        Save failed · retry ↻
      </button>
    );
  }

  const dirty = status === 'pending' || status === 'saving';
  const dotClass = dirty
    ? 'size-1.5 rounded-full bg-rust animate-pulse'
    : 'size-1.5 rounded-full bg-good';

  const label =
    status === 'pending'
      ? 'Editing…'
      : status === 'saving'
        ? 'Saving…'
        : status === 'idle' || lastSavedAt == null
          ? 'Autosaved'
          : `Saved ${formatRelative(lastSavedAt)}`;

  return (
    <span
      className={cn(
        baseClass,
        dirty ? 'text-rust' : 'text-ink-quiet',
        className,
      )}
    >
      <span aria-hidden className={dotClass} />
      {label}
    </span>
  );
}

function formatRelative(savedAt: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
