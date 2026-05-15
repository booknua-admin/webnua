'use client';

// =============================================================================
// useAutosave — the autosave hook driving the editor's section persistence.
//
// Behaviour (design doc §3.2):
//   - Debounced 500ms after the last edit per slot.
//   - On flush, status moves pending → saving → synced (or → failed).
//   - Optimistic UI: the editor never blocks on save. Errors surface as a
//     `failed` state with a `retry()` callback.
//
// The 5s server flush from §3.2 collapses to the same 500ms debounce in the
// stub because localStorage is synchronous — there's no separate "server"
// here. When backend lands, the 500ms cadence stays (it's the per-keystroke
// settle window) and a separate 5s heartbeat layer wraps it for genuinely-
// remote persistence.
//
// Submit-mid-edit edge case (§3.1):
//   The "current server-side draft state" referenced by submitForApproval
//   IS whatever has flushed to localStorage at submit time. Anything still
//   inside this 500ms debounce window stays in the operator's local React
//   state and is NOT in the submitted snapshot — it folds into the pending
//   version on the next flush, since the operator retains edit access to
//   the resulting pending_approval version (design doc §3.3 lane B).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type DraftSlot,
  saveDraftSections,
} from './draft-stub';
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
   *  submitter waiting on review) or in funnel-step mode pre-publish-stub. */
  disabled?: boolean;
};

export function useAutosave({
  slot,
  sections,
  disabled = false,
}: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Refs so the debounce closure always reads the latest values without
  // restarting the effect on every keystroke.
  const sectionsRef = useRef(sections);
  const slotRef = useRef(slot);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skip the first effect tick — initial mount shouldn't mark dirty.
  const skipNextRef = useRef(true);

  useEffect(() => {
    sectionsRef.current = sections;
    slotRef.current = slot;
  });

  const flush = useCallback(() => {
    setStatus('saving');
    const ok = saveDraftSections(slotRef.current, sectionsRef.current);
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
      flush();
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
    flush();
  }, [flush]);

  return { status, lastSavedAt, retry };
}
