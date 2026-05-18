'use client';

// =============================================================================
// useAutosave — autosave hook driving the editor's section persistence.
//
// Phase 4: `saveDraftSections` now upserts a `content_drafts` row in Supabase
// instead of writing localStorage. The hook's external API is unchanged
// (`{ status, lastSavedAt, retry }`) — `flush` is async internally.
//
// Behaviour (design doc §3.2):
//   - Debounced 500ms after the last edit per slot.
//   - On flush, status moves pending → saving → synced (or → failed).
//   - Optimistic UI: the editor never blocks on save; errors surface as a
//     `failed` state with a `retry()` callback.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

import { type DraftSlot, saveDraftSections } from './content-drafts';
import type { Section } from './types';

const DEBOUNCE_MS = 500;

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'synced' | 'failed';

export type UseAutosaveResult = {
  status: AutosaveStatus;
  /** ms epoch of the last successful save, null until first flush. */
  lastSavedAt: number | null;
  /** Manual retry for `failed` state. */
  retry: () => void;
};

export type UseAutosaveOptions = {
  slot: DraftSlot;
  sections: Section[];
  /** Disable autosave entirely — used when the editor is locked (Lane B
   *  submitter waiting on review). */
  disabled?: boolean;
};

export function useAutosave({
  slot,
  sections,
  disabled = false,
}: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const sectionsRef = useRef(sections);
  const slotRef = useRef(slot);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextRef = useRef(true);

  useEffect(() => {
    sectionsRef.current = sections;
    slotRef.current = slot;
  });

  const flush = useCallback(async () => {
    setStatus('saving');
    const ok = await saveDraftSections(slotRef.current, sectionsRef.current);
    if (ok) {
      setStatus('synced');
      setLastSavedAt(Date.now());
    } else {
      setStatus('failed');
    }
  }, []);

  // Schedule a debounced flush whenever sections change.
  useEffect(() => {
    if (disabled) return;
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    setStatus('pending');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      void flush();
      timeoutRef.current = null;
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [sections, disabled, flush]);

  // When disabled flips on, cancel any pending flush — locked editors
  // mustn't keep writing.
  useEffect(() => {
    if (disabled && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setStatus('idle');
    }
  }, [disabled]);

  const retry = useCallback(() => {
    void flush();
  }, [flush]);

  return { status, lastSavedAt, retry };
}
